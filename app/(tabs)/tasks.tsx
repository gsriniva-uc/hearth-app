import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, Linking, RefreshControl,
  ActivityIndicator, Modal, TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/app/_layout";
import { API_BASE_URL } from "@/constants/config";

interface Task {
  id: number;
  task_type: string;
  title: string;
  status: string;
  due_date: string;
  draft_to: string;
  draft_subject: string;
  draft_body: string;
  payment_url: string;
  amount: string;
  company_login_url: string;
  contact_name: string;
  thumbs: string;
}

export default function ActionsScreen() {
  const { user }     = useAuth();
  const USER_ID      = user?.user_id || "";

  const [tasks,      setTasks]      = useState<Task[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scanning,   setScanning]   = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editTask,   setEditTask]   = useState<Task | null>(null);
  const [editBody,   setEditBody]   = useState("");
  const [editTo,     setEditTo]     = useState("");
  const [editSubject,setEditSubject]= useState("");
  const [sending,    setSending]    = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!USER_ID) { setLoading(false); return; }
    try {
      const res  = await fetch(`${API_BASE_URL}/tasks?user_id=${USER_ID}`);
      const data = await res.json();
      setTasks(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [USER_ID]);

  useEffect(() => { load(); }, [load]);

  async function handleScan() {
    setScanning(true);
    try {
      const res    = await fetch(`${API_BASE_URL}/tasks/scan?user_id=${USER_ID}`,
                                { method: "POST" });
      const result = await res.json();
      Alert.alert("Scan complete",
        `Found ${result.bills_found} bill(s), ${result.patterns_found} pattern(s), `+
        `${result.tasks_created} new action(s).`);
      load();
    } catch {
      Alert.alert("Error", "Scan failed.");
    } finally {
      setScanning(false);
    }
  }

  async function handleSend(task: Task) {
    setSending(task.id);
    try {
      const res    = await fetch(
        `${API_BASE_URL}/tasks/${task.id}/send?user_id=${USER_ID}`,
        { method: "POST" });
      const result = await res.json();
      if (result.status === "sent") {
        Alert.alert("Sent!", "Email sent successfully.");
        load();
      } else {
        Alert.alert("Error", result.error || "Failed to send.");
      }
    } catch {
      Alert.alert("Error", "Could not send email.");
    } finally {
      setSending(null);
    }
  }

  async function handleSnooze(taskId: number, days: number) {
    await fetch(`${API_BASE_URL}/tasks/${taskId}/snooze?user_id=${USER_ID}&days=${days}`,
                { method: "POST" });
    load();
  }

  async function handleDone(taskId: number) {
    await fetch(`${API_BASE_URL}/tasks/${taskId}/done?user_id=${USER_ID}`,
                { method: "POST" });
    load();
  }

  async function handleThumbs(taskId: number, value: string) {
    await fetch(`${API_BASE_URL}/tasks/${taskId}/thumbs?user_id=${USER_ID}&value=${value}`,
                { method: "POST" });
    load();
  }

  async function handleSaveEdit() {
    if (!editTask) return;
    await fetch(`${API_BASE_URL}/tasks/${editTask.id}/draft?user_id=${USER_ID}`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ to: editTo, subject: editSubject, body: editBody }),
    });
    setEditTask(null);
    load();
  }

  function showSnoozeOptions(taskId: number) {
    Alert.alert("Snooze", "Snooze for how long?", [
      { text: "1 day",  onPress: () => handleSnooze(taskId, 1) },
      { text: "3 days", onPress: () => handleSnooze(taskId, 3) },
      { text: "1 week", onPress: () => handleSnooze(taskId, 7) },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  function getDueDateColor(due: string): string {
    if (!due) return "#A0856B";
    const days = Math.ceil((new Date(due).getTime() - Date.now()) / 86400000);
    if (days < 0)  return "#E84A4A";
    if (days <= 3) return "#E8734A";
    return "#A0856B";
  }

  function formatDueDate(due: string): string {
    if (!due) return "";
    try {
      const d    = new Date(due + "T12:00:00");
      const days = Math.ceil((new Date(due).getTime() - Date.now()) / 86400000);
      const fmt  = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      if (days < 0)   return "Overdue — " + fmt;
      if (days === 0) return "Due today";
      if (days === 1) return "Due tomorrow";
      if (days <= 7)  return "Due in " + days + " days";
      return "Due " + fmt;
    } catch { return due; }
  }

  const bills     = tasks.filter(t => t.task_type === "bill");
  const drafts    = tasks.filter(t => t.task_type === "draft");
  const followups = tasks.filter(t => t.task_type === "followup");

  const TaskCard = ({ task, section }: { task: Task; section: string }) => {
    const isExpanded = expandedId === task.id;
    const dueColor   = getDueDateColor(task.due_date);
    const dueLabel   = formatDueDate(task.due_date);

    return (
      <TouchableOpacity style={styles.card}
        onPress={() => setExpandedId(isExpanded ? null : task.id)}
        activeOpacity={0.8}>

        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{task.title}</Text>
            {dueLabel ? (
              <Text style={[styles.dueLabel, { color: dueColor }]}>{dueLabel}</Text>
            ) : null}
          </View>
          <View style={styles.thumbRow}>
            <TouchableOpacity onPress={() => handleThumbs(task.id, "up")}
              style={styles.thumbBtn}>
              <Ionicons name="thumbs-up-outline" size={16}
                color={task.thumbs === "up" ? "#4A9E6B" : "#C0A090"} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleThumbs(task.id, "down")}
              style={styles.thumbBtn}>
              <Ionicons name="thumbs-down-outline" size={16}
                color={task.thumbs === "down" ? "#E84A4A" : "#C0A090"} />
            </TouchableOpacity>
          </View>
        </View>

        {section === "bill" && (
          <View style={styles.actionRow}>
            {task.payment_url ? (
              <TouchableOpacity style={styles.payBtn}
                onPress={() => Linking.openURL(task.payment_url)}>
                <Ionicons name="card" size={14} color="#fff" />
                <Text style={styles.payBtnText}>Pay now →</Text>
              </TouchableOpacity>
            ) : task.company_login_url ? (
              <TouchableOpacity style={styles.loginBtn}
                onPress={() => Linking.openURL(task.company_login_url)}>
                <Ionicons name="log-in-outline" size={14} color="#E8734A" />
                <Text style={styles.loginBtnText}>Log in to pay →</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.noLinkText}>Log in to company website to pay</Text>
            )}
            <TouchableOpacity style={styles.snoozeBtn}
              onPress={() => showSnoozeOptions(task.id)}>
              <Text style={styles.snoozeBtnText}>Snooze</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.doneBtn}
              onPress={() => handleDone(task.id)}>
              <Ionicons name="checkmark" size={14} color="#4A9E6B" />
            </TouchableOpacity>
          </View>
        )}

        {(section === "draft" || section === "followup") && (
          <>
            {isExpanded && task.draft_body ? (
              <View style={styles.draftPreview}>
                <Text style={styles.draftTo}>To: {task.draft_to}</Text>
                <Text style={styles.draftSubject}>Subject: {task.draft_subject}</Text>
                <Text style={styles.draftBody}>{task.draft_body}</Text>
              </View>
            ) : null}
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.sendBtn}
                onPress={() => handleSend(task)}
                disabled={sending === task.id}>
                {sending === task.id
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <>
                      <Ionicons name="send" size={14} color="#fff" />
                      <Text style={styles.sendBtnText}>Send</Text>
                    </>
                }
              </TouchableOpacity>
              <TouchableOpacity style={styles.editBtn}
                onPress={() => {
                  setEditTask(task);
                  setEditTo(task.draft_to || "");
                  setEditSubject(task.draft_subject || "");
                  setEditBody(task.draft_body || "");
                }}>
                <Ionicons name="pencil" size={14} color="#E8734A" />
                <Text style={styles.editBtnText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.snoozeBtn}
                onPress={() => showSnoozeOptions(task.id)}>
                <Text style={styles.snoozeBtnText}>Snooze</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.doneBtn}
                onPress={() => handleDone(task.id)}>
                <Ionicons name="checkmark" size={14} color="#4A9E6B" />
              </TouchableOpacity>
            </View>
          </>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#E8734A" />
    </View>
  );

  return (
    <>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); load(); }} />}>

        <View style={styles.header}>
          <Text style={styles.title}>Actions</Text>
          <TouchableOpacity style={styles.scanBtn} onPress={handleScan}
            disabled={scanning}>
            {scanning
              ? <ActivityIndicator size="small" color="#fff" />
              : <><Ionicons name="search" size={14} color="#fff" />
                  <Text style={styles.scanBtnText}>Scan</Text></>
            }
          </TouchableOpacity>
        </View>

        <Text style={styles.section}>💳 BILLS DUE</Text>
        {bills.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No bills detected</Text>
          </View>
        ) : bills.map(t => <TaskCard key={t.id} task={t} section="bill" />)}

        <Text style={styles.section}>📧 DRAFTS READY</Text>
        {drafts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No drafts yet — tap Scan to detect patterns</Text>
          </View>
        ) : drafts.map(t => <TaskCard key={t.id} task={t} section="draft" />)}

        <Text style={styles.section}>🔁 FOLLOW-UPS</Text>
        {followups.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No follow-ups pending</Text>
          </View>
        ) : followups.map(t => <TaskCard key={t.id} task={t} section="followup" />)}

      </ScrollView>

      <Modal visible={!!editTask} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Edit Draft</Text>
            <Text style={styles.inputLabel}>To:</Text>
            <TextInput style={styles.input} value={editTo}
              onChangeText={setEditTo} keyboardType="email-address" />
            <Text style={styles.inputLabel}>Subject:</Text>
            <TextInput style={styles.input} value={editSubject}
              onChangeText={setEditSubject} />
            <Text style={styles.inputLabel}>Message:</Text>
            <TextInput style={[styles.input, styles.inputMulti]}
              value={editBody} onChangeText={setEditBody}
              multiline numberOfLines={6} textAlignVertical="top" />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={[styles.sendBtn, { flex: 1, justifyContent: "center" }]}
                onPress={handleSaveEdit}>
                <Text style={styles.sendBtnText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.snoozeBtn, { flex: 1, justifyContent: "center" }]}
                onPress={() => setEditTask(null)}>
                <Text style={styles.snoozeBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  scroll:        { flex: 1, backgroundColor: "#FFF8F0" },
  content:       { padding: 20, paddingTop: 60, paddingBottom: 60 },
  center:        { flex: 1, alignItems: "center", justifyContent: "center" },
  header:        { flexDirection: "row", justifyContent: "space-between",
                   alignItems: "center", marginBottom: 16 },
  title:         { fontSize: 26, fontWeight: "800", color: "#8B4513" },
  scanBtn:       { flexDirection: "row", alignItems: "center", gap: 6,
                   backgroundColor: "#E8734A", borderRadius: 20,
                   paddingVertical: 8, paddingHorizontal: 14 },
  scanBtnText:   { color: "#fff", fontWeight: "700", fontSize: 13 },
  section:       { fontSize: 11, fontWeight: "700", color: "#A0856B",
                   letterSpacing: 1.5, marginTop: 20, marginBottom: 10 },
  emptyCard:     { backgroundColor: "#F5F5F5", borderRadius: 12,
                   padding: 14, alignItems: "center" },
  emptyText:     { color: "#A0856B", fontSize: 13 },
  card:          { backgroundColor: "#fff", borderRadius: 14, padding: 14,
                   marginBottom: 10, elevation: 2 },
  cardHeader:    { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  cardTitle:     { fontSize: 14, fontWeight: "700", color: "#5C4033", flex: 1 },
  dueLabel:      { fontSize: 12, marginTop: 3 },
  thumbRow:      { flexDirection: "row", gap: 4 },
  thumbBtn:      { padding: 4 },
  actionRow:     { flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" },
  payBtn:        { flexDirection: "row", alignItems: "center", gap: 4,
                   backgroundColor: "#4A7BE8", borderRadius: 8,
                   paddingVertical: 8, paddingHorizontal: 12 },
  payBtnText:    { color: "#fff", fontWeight: "700", fontSize: 13 },
  loginBtn:      { flexDirection: "row", alignItems: "center", gap: 4,
                   borderWidth: 1.5, borderColor: "#E8734A", borderRadius: 8,
                   paddingVertical: 7, paddingHorizontal: 12 },
  loginBtnText:  { color: "#E8734A", fontWeight: "600", fontSize: 13 },
  noLinkText:    { fontSize: 12, color: "#A0856B", flex: 1 },
  sendBtn:       { flexDirection: "row", alignItems: "center", gap: 4,
                   backgroundColor: "#E8734A", borderRadius: 8,
                   paddingVertical: 8, paddingHorizontal: 12 },
  sendBtnText:   { color: "#fff", fontWeight: "700", fontSize: 13 },
  editBtn:       { flexDirection: "row", alignItems: "center", gap: 4,
                   borderWidth: 1.5, borderColor: "#E8734A", borderRadius: 8,
                   paddingVertical: 7, paddingHorizontal: 12 },
  editBtnText:   { color: "#E8734A", fontWeight: "600", fontSize: 13 },
  snoozeBtn:     { borderWidth: 1, borderColor: "#C0A090", borderRadius: 8,
                   paddingVertical: 7, paddingHorizontal: 10 },
  snoozeBtnText: { color: "#A0856B", fontSize: 13 },
  doneBtn:       { backgroundColor: "#F0FFF4", borderRadius: 8,
                   padding: 8, borderWidth: 1, borderColor: "#4A9E6B" },
  draftPreview:  { backgroundColor: "#FFF8F0", borderRadius: 10,
                   padding: 12, marginBottom: 10 },
  draftTo:       { fontSize: 12, color: "#A0856B", marginBottom: 2 },
  draftSubject:  { fontSize: 12, fontWeight: "600", color: "#5C4033", marginBottom: 6 },
  draftBody:     { fontSize: 13, color: "#5C4033", lineHeight: 18 },
  modalOverlay:  { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalBox:      { backgroundColor: "#FFF8F0", borderRadius: 24, padding: 24, margin: 16 },
  modalTitle:    { fontSize: 18, fontWeight: "800", color: "#8B4513", marginBottom: 16 },
  inputLabel:    { fontSize: 12, fontWeight: "700", color: "#A0856B", marginBottom: 4 },
  input:         { backgroundColor: "#fff", borderRadius: 10, padding: 12,
                   fontSize: 14, color: "#5C4033", borderWidth: 1,
                   borderColor: "#F5E6D3", marginBottom: 10 },
  inputMulti:    { height: 120 },
});
