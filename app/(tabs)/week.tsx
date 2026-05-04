import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, StyleSheet, ActivityIndicator,
} from "react-native";
import { useAuth } from "@/app/_layout";
import { API_BASE_URL } from "@/constants/config";

const WINDOWS = [7, 14, 30, 60];

const EVENT_ICONS: Record<string, string> = {
  dress_down_day:     "👕",
  early_dismissal:    "🏫",
  recital:            "🎭",
  movie_night:        "🎬",
  field_trip:         "🚌",
  special_day:        "⭐",
  doctor_appointment: "🏥",
  sports_game:        "⚽",
  school_holiday:     "🎉",
  activity:           "🎨",
  other:              "📅",
};

export default function WeekScreen() {
  const { user }     = useAuth();
  const USER_ID      = user?.user_id || "";
  const [events,     setEvents]     = useState<any[]>([]);
  const [daysAhead,  setDaysAhead]  = useState(14);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!USER_ID) { setLoading(false); return; }
    try {
      const res  = await fetch(`${API_BASE_URL}/events?user_id=${USER_ID}&days_ahead=${daysAhead}`);
      const data = await res.json();
      setEvents(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [USER_ID, daysAhead]);

  useEffect(() => { load(); }, [load]);

  const grouped = events.reduce<Record<string, any[]>>((acc, ev) => {
    if (!acc[ev.event_date]) acc[ev.event_date] = [];
    acc[ev.event_date].push(ev);
    return acc;
  }, {});

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing}
        onRefresh={() => { setRefreshing(true); load(); }} />}>

      <Text style={styles.title}>Upcoming Events</Text>

      <View style={styles.windowRow}>
        {WINDOWS.map(d => (
          <TouchableOpacity key={d}
            style={[styles.windowBtn, daysAhead === d && styles.windowBtnActive]}
            onPress={() => setDaysAhead(d)}>
            <Text style={[styles.windowText, daysAhead === d && styles.windowTextActive]}>
              {d}d
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color="#E8734A" style={{ marginTop: 40 }} />
      ) : Object.keys(grouped).length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No events found</Text>
          <Text style={styles.emptySubtitle}>Try selecting more days above</Text>
        </View>
      ) : (
        Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b))
          .map(([dateStr, evs]) => {
            const d     = new Date(dateStr + "T12:00:00");
            const label = d.toLocaleDateString("en-US",
              { weekday: "short", month: "2-digit", day: "2-digit", year: "2-digit" });
            return (
              <View key={dateStr} style={styles.dayGroup}>
                <Text style={styles.dayLabel}>{label}</Text>
                {evs.map((ev: any) => {
                  const isExpanded = expandedId === ev.id;
                  const icon       = EVENT_ICONS[ev.event_type] || "📅";
                  const typeLabel  = ev.event_type
                    .replace(/_/g, " ")
                    .replace(/\b\w/g, (c: string) => c.toUpperCase());
                  const hasLongNote = ev.notes && ev.notes.length > 60;

                  return (
                    <TouchableOpacity key={ev.id} style={styles.eventCard}
                      onPress={() => setExpandedId(isExpanded ? null : ev.id)}
                      activeOpacity={0.7}>
                      <Text style={styles.eventIcon}>{icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.eventChild}>{ev.child_name}</Text>
                        <Text style={styles.eventLabel}>{typeLabel}</Text>
                        {ev.event_time ? (
                          <Text style={styles.eventTime}>🕐 {ev.event_time}</Text>
                        ) : null}
                        {ev.notes ? (
                          <Text style={styles.eventNotes}
                            numberOfLines={isExpanded ? 0 : 2}>
                            {ev.notes}
                          </Text>
                        ) : null}
                        {hasLongNote ? (
                          <Text style={styles.expandHint}>
                            {isExpanded ? "▲ less" : "▼ more"}
                          </Text>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll:           { flex: 1, backgroundColor: "#FFF8F0" },
  content:          { padding: 20, paddingBottom: 40, paddingTop: 60 },
  title:            { fontSize: 26, fontWeight: "800", color: "#8B4513", marginBottom: 16 },
  windowRow:        { flexDirection: "row", gap: 8, marginBottom: 20 },
  windowBtn:        { paddingVertical: 8, paddingHorizontal: 16,
                      borderRadius: 20, backgroundColor: "#F5E6D3" },
  windowBtnActive:  { backgroundColor: "#E8734A" },
  windowText:       { color: "#8B4513", fontWeight: "600", fontSize: 13 },
  windowTextActive: { color: "#fff" },
  dayGroup:         { marginBottom: 20 },
  dayLabel:         { fontSize: 13, fontWeight: "700", color: "#A0856B",
                      letterSpacing: 0.5, marginBottom: 8 },
  eventCard:        { flexDirection: "row", backgroundColor: "#fff",
                      borderRadius: 14, padding: 14, marginBottom: 8, elevation: 2 },
  eventIcon:        { fontSize: 28, marginRight: 12 },
  eventChild:       { fontSize: 13, fontWeight: "700", color: "#E8734A" },
  eventLabel:       { fontSize: 15, fontWeight: "600", color: "#5C4033", marginTop: 2 },
  eventTime:        { fontSize: 12, color: "#E8734A", marginTop: 3, fontWeight: "600" },
  eventNotes:       { fontSize: 12, color: "#A0856B", marginTop: 4, lineHeight: 16 },
  expandHint:       { fontSize: 11, color: "#C0A090", marginTop: 4 },
  empty:            { alignItems: "center", marginTop: 60, gap: 8 },
  emptyTitle:       { fontSize: 18, fontWeight: "700", color: "#8B4513" },
  emptySubtitle:    { fontSize: 14, color: "#A0856B" },
});
