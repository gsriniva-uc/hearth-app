/**
 * app/(tabs)/week.tsx — This Week screen
 */
import { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, StyleSheet, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { globalUser } from "@/app/_layout";
import { getUpcomingEvents } from "@/lib/api";
import { HearthEvent } from "@/lib/types";
import EventCard from "@/components/EventCard";

const WINDOWS = [7, 14, 30, 60];

export default function WeekScreen() {
  const insets = useSafeAreaInsets();
  const user   = globalUser!;

  const [events,     setEvents]     = useState<HearthEvent[]>([]);
  const [daysAhead,  setDaysAhead]  = useState(14);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getUpcomingEvents(user.user_id, daysAhead);
      setEvents(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user.user_id, daysAhead]);

  useEffect(() => { load(); }, [load]);

  // Group events by date
  const grouped = events.reduce<Record<string, HearthEvent[]>>((acc, ev) => {
    if (!acc[ev.event_date]) acc[ev.event_date] = [];
    acc[ev.event_date].push(ev);
    return acc;
  }, {});

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      refreshControl={<RefreshControl refreshing={refreshing}
        onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      <Text style={styles.title}>Upcoming Events</Text>

      {/* Window selector */}
      <View style={styles.windowRow}>
        {WINDOWS.map(d => (
          <TouchableOpacity
            key={d}
            style={[styles.windowBtn, daysAhead === d && styles.windowBtnActive]}
            onPress={() => setDaysAhead(d)}
          >
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
          <Text style={styles.emptyTitle}>Nothing scheduled</Text>
          <Text style={styles.emptySubtitle}>
            Add events manually or let Hearth scan your Gmail
          </Text>
        </View>
      ) : (
        Object.entries(grouped)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([dateStr, evs]) => {
            const d = new Date(dateStr + "T12:00:00");
            const label = d.toLocaleDateString("en-US", {
              weekday:"long", month:"short", day:"numeric"
            });
            return (
              <View key={dateStr} style={styles.dayGroup}>
                <Text style={styles.dayLabel}>{label}</Text>
                {evs.map(ev => (
                  <EventCard key={ev.id} event={ev} onDelete={load} />
                ))}
              </View>
            );
          })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll:           { flex:1, backgroundColor:"#FFF8F0" },
  content:          { padding:20, paddingBottom:40 },
  title:            { fontSize:26, fontWeight:"800", color:"#8B4513", marginBottom:16 },
  windowRow:        { flexDirection:"row", gap:8, marginBottom:20 },
  windowBtn:        { paddingVertical:8, paddingHorizontal:16, borderRadius:20,
                      backgroundColor:"#F5E6D3" },
  windowBtnActive:  { backgroundColor:"#E8734A" },
  windowText:       { color:"#8B4513", fontWeight:"600", fontSize:13 },
  windowTextActive: { color:"#fff" },
  dayGroup:         { marginBottom:20 },
  dayLabel:         { fontSize:13, fontWeight:"700", color:"#A0856B",
                      letterSpacing:0.5, marginBottom:8 },
  empty:            { alignItems:"center", marginTop:60, gap:8 },
  emptyTitle:       { fontSize:18, fontWeight:"700", color:"#8B4513" },
  emptySubtitle:    { fontSize:14, color:"#A0856B", textAlign:"center" },
});
