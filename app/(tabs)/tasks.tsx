/**
 * app/(tabs)/tasks.tsx — Action items screen
 *
 * Shows tasks that need action:
 *   - Email drafts (prescription refills, doctor follow-ups)
 *   - Bill payments with direct link
 *   - Follow-ups on unanswered emails
 *   - User-created reminders
 */
import { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, RefreshControl,
  StyleSheet, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { globalUser } from "@/app/_layout";
import { getPendingTasks } from "@/lib/api";
import { Task } from "@/lib/types";
import TaskCard from "@/components/TaskCard";

export default function TasksScreen() {
  const insets = useSafeAreaInsets();
  const user   = globalUser!;

  const [tasks,      setTasks]      = useState<Task[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getPendingTasks(user.user_id);
      setTasks(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user.user_id]);

  useEffect(() => { load(); }, [load]);

  // Group tasks by type
  const drafts   = tasks.filter(t => t.task_type === "email_draft");
  const payments = tasks.filter(t => t.task_type === "payment");
  const followups= tasks.filter(t => t.task_type === "follow_up");
  const reminders= tasks.filter(t => t.task_type === "reminder");

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#E8734A" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      refreshControl={<RefreshControl refreshing={refreshing}
        onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      <Text style={styles.title}>Action Items</Text>
      <Text style={styles.subtitle}>
        {tasks.length === 0
          ? "You're all caught up ✓"
          : `${tasks.length} item${tasks.length > 1 ? "s" : ""} need your attention`}
      </Text>

      {tasks.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>✅</Text>
          <Text style={styles.emptyTitle}>Nothing pending</Text>
          <Text style={styles.emptySubtitle}>
            Hearth will surface email drafts, bill reminders, and
            follow-ups here automatically.
          </Text>
        </View>
      )}

      {drafts.length > 0 && (
        <>
          <Text style={styles.groupLabel}>📧 DRAFTS READY TO SEND</Text>
          {drafts.map(t => (
            <TaskCard key={t.id} task={t} userId={user.user_id} onAction={load} />
          ))}
        </>
      )}

      {payments.length > 0 && (
        <>
          <Text style={styles.groupLabel}>💳 BILLS DUE</Text>
          {payments.map(t => (
            <TaskCard key={t.id} task={t} userId={user.user_id} onAction={load} />
          ))}
        </>
      )}

      {followups.length > 0 && (
        <>
          <Text style={styles.groupLabel}>🔁 FOLLOW-UPS</Text>
          {followups.map(t => (
            <TaskCard key={t.id} task={t} userId={user.user_id} onAction={load} />
          ))}
        </>
      )}

      {reminders.length > 0 && (
        <>
          <Text style={styles.groupLabel}>⏰ REMINDERS</Text>
          {reminders.map(t => (
            <TaskCard key={t.id} task={t} userId={user.user_id} onAction={load} />
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll:        { flex:1, backgroundColor:"#FFF8F0" },
  content:       { padding:20, paddingBottom:40 },
  center:        { flex:1, alignItems:"center", justifyContent:"center" },
  title:         { fontSize:26, fontWeight:"800", color:"#8B4513" },
  subtitle:      { fontSize:14, color:"#A0856B", marginTop:4, marginBottom:20 },
  groupLabel:    { fontSize:11, fontWeight:"700", color:"#A0856B",
                   letterSpacing:1.5, marginTop:20, marginBottom:10 },
  empty:         { alignItems:"center", marginTop:60, gap:12 },
  emptyEmoji:    { fontSize:48 },
  emptyTitle:    { fontSize:20, fontWeight:"700", color:"#8B4513" },
  emptySubtitle: { fontSize:14, color:"#A0856B", textAlign:"center",
                   lineHeight:20, paddingHorizontal:20 },
});
