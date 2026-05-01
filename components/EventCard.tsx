/**
 * components/EventCard.tsx — Reusable event display card
 */
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { globalUser } from "@/app/_layout";
import { deleteEvent } from "@/lib/api";
import { HearthEvent } from "@/lib/types";

const EVENT_ICONS: Record<string, string> = {
  dress_down_day:    "👕",
  early_dismissal:   "🏫",
  recital:           "🎭",
  movie_night:       "🎬",
  field_trip:        "🚌",
  special_day:       "⭐",
  doctor_appointment:"🏥",
  sports_game:       "⚽",
  school_holiday:    "🎉",
  bill_due:          "💳",
  other:             "📅",
};

interface Props {
  event:    HearthEvent;
  compact?: boolean;
  onDelete: () => void;
}

export default function EventCard({ event, compact, onDelete }: Props) {
  const user  = globalUser!;
  const icon  = EVENT_ICONS[event.event_type] || "📅";
  const label = event.event_type.replace(/_/g, " ")
    .split(" ").map(w => w[0].toUpperCase() + w.slice(1)).join(" ");

  async function handleDelete() {
    Alert.alert("Delete event", `Remove ${label} for ${event.child_name}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        await deleteEvent(user.user_id, event.id);
        onDelete();
      }},
    ]);
  }

  return (
    <View style={[styles.card, compact && styles.compact]}>
      <Text style={styles.icon}>{icon}</Text>
      <View style={styles.body}>
        <Text style={styles.child}>{event.child_name}</Text>
        <Text style={styles.label}>{label}</Text>
        {event.event_time && (
          <Text style={styles.time}>at {event.event_time}</Text>
        )}
        {event.notes && !compact && (
          <Text style={styles.notes} numberOfLines={2}>{event.notes}</Text>
        )}
      </View>
      <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
        <Ionicons name="trash-outline" size={16} color="#D0B0A0" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card:      { flexDirection:"row", backgroundColor:"#fff", borderRadius:14,
               padding:14, marginBottom:8, alignItems:"flex-start",
               shadowColor:"#000", shadowOpacity:0.05, shadowRadius:6 },
  compact:   { padding:10, backgroundColor:"#F5E6D3" },
  icon:      { fontSize:28, marginRight:12, marginTop:2 },
  body:      { flex:1 },
  child:     { fontSize:13, fontWeight:"700", color:"#E8734A" },
  label:     { fontSize:15, fontWeight:"600", color:"#5C4033", marginTop:1 },
  time:      { fontSize:13, color:"#A0856B", marginTop:2 },
  notes:     { fontSize:12, color:"#A0856B", marginTop:4, lineHeight:16 },
  deleteBtn: { padding:4, marginLeft:8 },
});
