import { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, RefreshControl, ActivityIndicator, TextInput,
  Modal, Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import { useAuth } from "@/app/_layout";
import { API_BASE_URL } from "@/constants/config";

export default function TasksScreen() {
  const { user } = useAuth();
  const USER_ID  = user?.user_id || "";

  const [tasks,        setTasks]        = useState<any[]>([]);
  const [camps,        setCamps]        = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [chatInput,    setChatInput]    = useState("");
  const [chatLoading,  setChatLoading]  = useState(false);
  const [chatReply,    setChatReply]    = useState("");
  const [isRecording,  setIsRecording]  = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [showEdit,     setShowEdit]     = useState(false);
  const [editTask,     setEditTask]     = useState<any>(null);
  const [editBody,     setEditBody]     = useState("");
  const recordingRef = useRef<any>(null);

  const load = useCallback(async () => {
    if (!USER_ID) { setLoading(false); return; }
    try {
      const res  = await fetch(`${API_BASE_URL}/tasks?user_id=${USER_ID}`);
      const data = await res.json();
      setTasks(Array.isArray(data) ? data : []);
    } catch (e) { console.error("tasks:", e); }
    try {
      const res  = await fetch(`${API_BASE_URL}/camps?user_id=${USER_ID}`);
      const data = await res.json();
      setCamps(Array.isArray(data) ? data : []);
    } catch (e) { console.error("camps:", e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [USER_ID]);

  useEffect(() => { load(); }, [load]);

  async function handleScan() {
    try {
      setChatLoading(true);
      await fetch(`${API_BASE_URL}/tasks/scan?user_id=${USER_ID}`, { method: "POST" });
      await load();
      Alert.alert("Done", "Actions refreshed from Gmail.");
    } catch { Alert.alert("Error", "Scan failed."); }
    finally { setChatLoading(false); }
  }

  async function handleSend(text: string) {
    if (!text.trim()) return;
    setChatLoading(true);
    try {
      const res  = await fetch(`${API_BASE_URL}/agent`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: USER_ID, raw_text: text.trim() }),
      });
      const data = await res.json();
      setChatReply(data.response || "");
      setChatInput("");
      await load();
    } catch { Alert.alert("Error", "Could not reach Hearth."); }
    finally { setChatLoading(false); }
  }

  async function handleMic() {
    if (isRecording) {
      setIsRecording(false);
      setIsTranscribing(true);
      try {
        await recordingRef.current?.stopAndUnloadAsync();
        const uri = recordingRef.current?.getURI();
        recordingRef.current = null;
        if (uri) {
          const b64 = await FileSystem.readAsStringAsync(uri, { encoding: "base64" });
          const res = await fetch(`${API_BASE_URL}/transcribe?user_id=${USER_ID}`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ audio: b64 }),
          });
          const d = await res.json();
          if (d.transcript) setChatInput(d.transcript);
        }
      } catch (e) { console.error(e); }
      finally { setIsTranscribing(false); }
    } else {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) return;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      setIsRecording(true);
    }
  }

  async function markCampRegistered(campId: number) {
    try {
      await fetch(`${API_BASE_URL}/camps/${campId}/status`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: USER_ID, status: "registered" }),
      });
      await load();
    } catch (e) { console.error(e); }
  }

  const bills    = tasks.filter(t => t.task_type === "bill");
  const drafts   = tasks.filter(t => t.task_type === "draft");
  const followups = tasks.filter(t => t.task_type === "followup");

  if (loading) return (
    <View style={styles.center}><ActivityIndicator size="large" color="#E8734A" /></View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#FFF8F0" }}>
      <ScrollView contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); load(); }} />}>

        <Text style={styles.title}>Actions</Text>

        {/* Scan button */}
        <TouchableOpacity style={styles.scanBtn} onPress={handleScan} disabled={chatLoading}>
          <Ionicons name="refresh" size={16} color="#fff" />
          <Text style={styles.scanBtnText}>{chatLoading ? "Scanning..." : "Scan Gmail for actions"}</Text>
        </TouchableOpacity>

        {/* Bills */}
        {bills.length > 0 && (
          <View>
            <Text style={styles.section}>💳 BILLS DUE</Text>
            {bills.map(t => (
              <View key={t.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{t.title}</Text>
                  {t.due_date && <Text style={styles.cardDue}>Due {t.due_date}</Text>}
                </View>
                <View style={styles.cardActions}>
                  {t.payment_url
                    ? <TouchableOpacity style={styles.primaryBtn}
                        onPress={() => Linking.openURL(t.payment_url)}>
                        <Text style={styles.primaryBtnText}>Pay Now</Text>
                      </TouchableOpacity>
                    : null}
                  {t.company_login_url
                    ? <TouchableOpacity style={styles.ghostBtn}
                        onPress={() => Linking.openURL(t.company_login_url)}>
                        <Text style={styles.ghostBtnText}>Log In</Text>
                      </TouchableOpacity>
                    : null}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Drafts */}
        {drafts.length > 0 && (
          <View>
            <Text style={styles.section}>✉️ DRAFT EMAILS</Text>
            {drafts.map(t => (
              <View key={t.id} style={styles.card}>
                <Text style={styles.cardTitle}>{t.title}</Text>
                {t.draft_to && <Text style={styles.cardSub}>To: {t.draft_to}</Text>}
                <View style={styles.cardActions}>
                  <TouchableOpacity style={styles.primaryBtn} onPress={async () => {
                    await fetch(`${API_BASE_URL}/tasks/${t.id}/send?user_id=${USER_ID}`, { method: "POST" });
                    await load();
                    Alert.alert("Sent!", "Email sent successfully.");
                  }}>
                    <Text style={styles.primaryBtnText}>Send</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.ghostBtn} onPress={() => {
                    setEditTask(t); setEditBody(t.draft_body || ""); setShowEdit(true);
                  }}>
                    <Text style={styles.ghostBtnText}>Edit</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Follow-ups */}
        {followups.length > 0 && (
          <View>
            <Text style={styles.section}>🔔 FOLLOW-UPS</Text>
            {followups.map(t => (
              <View key={t.id} style={styles.card}>
                <Text style={styles.cardTitle}>{t.title}</Text>
                <View style={styles.cardActions}>
                  <TouchableOpacity style={styles.primaryBtn} onPress={async () => {
                    await fetch(`${API_BASE_URL}/tasks/${t.id}/done?user_id=${USER_ID}`, { method: "POST" });
                    await load();
                  }}>
                    <Text style={styles.primaryBtnText}>Done</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Camps */}
        {camps.length > 0 && (
          <View>
            <Text style={styles.section}>🏕️ CAMPS & ACTIVITIES</Text>
            {camps.map(camp => {
              const deadline    = camp.registration_deadline;
              const deadlineMs  = deadline ? new Date(deadline).getTime() : 0;
              const nowMs       = Date.now();
              const in3Days     = nowMs + 3 * 86400000;
              const isUrgent    = deadlineMs > 0 && deadlineMs <= in3Days && deadlineMs >= nowMs;
              const isPast      = deadlineMs > 0 && deadlineMs < nowMs;
              const isRegistered = camp.status === "registered";

              return (
                <View key={camp.id} style={[styles.campCard, isUrgent ? styles.campCardUrgent : null]}>
                  <View style={styles.campHeader}>
                    <View style={{ flex: 1 }}>
                      {camp.child_name
                        ? <Text style={styles.campChild}>{camp.child_name}</Text>
                        : null}
                      <Text style={styles.campName}>{camp.camp_name}</Text>
                    </View>
                    <View style={[styles.campBadge,
                      isRegistered ? styles.campBadgeGreen : isPast ? styles.campBadgeRed : styles.campBadgeOrange]}>
                      <Text style={styles.campBadgeText}>
                        {isRegistered ? "✅ Registered" : isPast ? "⚠️ Expired" : "Pending"}
                      </Text>
                    </View>
                  </View>
                  {deadline
                    ? <Text style={[styles.campDeadline, isUrgent ? { color: "#E84A4A" } : null]}>
                        📅 Register by {deadline}
                      </Text>
                    : null}
                  {(camp.camp_start_date || camp.camp_end_date)
                    ? <Text style={styles.campDates}>
                        🗓️ {camp.camp_start_date} → {camp.camp_end_date}
                      </Text>
                    : null}
                  <View style={styles.campActions}>
                    {camp.registration_url
                      ? <TouchableOpacity style={styles.primaryBtn}
                          onPress={() => Linking.openURL(camp.registration_url)}>
                          <Text style={styles.primaryBtnText}>Register →</Text>
                        </TouchableOpacity>
                      : <Text style={styles.campNoLink}>🔍 Searching for link...</Text>}
                    {!isRegistered
                      ? <TouchableOpacity style={styles.ghostBtn}
                          onPress={() => markCampRegistered(camp.id)}>
                          <Text style={styles.ghostBtnText}>Mark Registered</Text>
                        </TouchableOpacity>
                      : null}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {bills.length === 0 && drafts.length === 0 && followups.length === 0 && camps.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>✓</Text>
            <Text style={styles.emptyTitle}>All caught up</Text>
            <Text style={styles.emptySub}>Tap "Scan Gmail" to find bills and follow-ups</Text>
          </View>
        )}

        {/* Pattern chat */}
        <Text style={styles.section}>➕ ADD REMINDER PATTERN</Text>
        {chatReply
          ? <View style={styles.replyCard}>
              <Text style={styles.replyText}>{chatReply}</Text>
              <TouchableOpacity onPress={() => setChatReply("")}>
                <Text style={styles.dismiss}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          : null}
        {isRecording
          ? <View style={styles.recordingBar}>
              <Text style={styles.recordingText}>🎙️ Recording... tap mic to stop</Text>
            </View>
          : null}
        {isTranscribing
          ? <View style={styles.recordingBar}>
              <ActivityIndicator size="small" color="#E8734A" />
              <Text style={styles.recordingText}>  Transcribing...</Text>
            </View>
          : null}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="e.g. Remind me to refill Emma's prescription every 30 days"
            placeholderTextColor="#A0856B"
            value={chatInput}
            onChangeText={setChatInput}
            multiline
          />
          <TouchableOpacity style={styles.micBtn} onPress={handleMic}>
            <Ionicons name={isRecording ? "stop-circle" : "mic"} size={20}
              color={isRecording ? "#E84A4A" : "#A0856B"} />
          </TouchableOpacity>
          {chatInput.trim()
            ? <TouchableOpacity style={styles.sendBtn} onPress={() => handleSend(chatInput)} disabled={chatLoading}>
                {chatLoading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="arrow-up" size={18} color="#fff" />}
              </TouchableOpacity>
            : null}
        </View>

      </ScrollView>

      {/* Edit draft modal */}
      <Modal visible={showEdit} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Edit Draft</Text>
            <TextInput
              style={styles.modalInput}
              value={editBody}
              onChangeText={setEditBody}
              multiline
              numberOfLines={6}
            />
            <TouchableOpacity style={styles.primaryBtnFull} onPress={async () => {
              await fetch(`${API_BASE_URL}/tasks/${editTask?.id}/draft?user_id=${USER_ID}`, {
                method: "PUT", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ body: editBody, subject: editTask?.draft_subject, to: editTask?.draft_to }),
              });
              setShowEdit(false); await load();
            }}>
              <Text style={styles.primaryBtnText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowEdit(false)} style={{ alignItems: "center", marginTop: 12 }}>
              <Text style={{ color: "#A0856B" }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  center:          { flex: 1, alignItems: "center", justifyContent: "center" },
  content:         { padding: 20, paddingTop: 60, paddingBottom: 60 },
  title:           { fontSize: 26, fontWeight: "800", color: "#8B4513", marginBottom: 16 },
  scanBtn:         { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#4A7BE8",
                     borderRadius: 12, padding: 12, justifyContent: "center", marginBottom: 8 },
  scanBtnText:     { color: "#fff", fontWeight: "600", fontSize: 14 },
  section:         { fontSize: 11, fontWeight: "700", color: "#A0856B", letterSpacing: 1.5,
                     marginTop: 24, marginBottom: 10 },
  card:            { backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 10,
                     elevation: 2, borderWidth: 1, borderColor: "#F5E6D3" },
  cardHeader:      { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  cardTitle:       { fontSize: 15, fontWeight: "700", color: "#5C4033", flex: 1 },
  cardDue:         { fontSize: 12, color: "#E8734A", fontWeight: "600" },
  cardSub:         { fontSize: 12, color: "#A0856B", marginBottom: 8 },
  cardActions:     { flexDirection: "row", gap: 8, marginTop: 8 },
  primaryBtn:      { backgroundColor: "#E8734A", borderRadius: 10, paddingVertical: 8, paddingHorizontal: 16 },
  primaryBtnText:  { color: "#fff", fontWeight: "700", fontSize: 13 },
  primaryBtnFull:  { backgroundColor: "#E8734A", borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  ghostBtn:        { borderWidth: 1, borderColor: "#E8734A", borderRadius: 10, paddingVertical: 8, paddingHorizontal: 16 },
  ghostBtnText:    { color: "#E8734A", fontWeight: "600", fontSize: 13 },
  campCard:        { backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 10,
                     elevation: 2, borderWidth: 1, borderColor: "#F5E6D3" },
  campCardUrgent:  { borderColor: "#E84A4A", borderWidth: 2 },
  campHeader:      { flexDirection: "row", alignItems: "flex-start", marginBottom: 6 },
  campChild:       { fontSize: 12, fontWeight: "700", color: "#E8734A", marginBottom: 2 },
  campName:        { fontSize: 15, fontWeight: "700", color: "#5C4033" },
  campBadge:       { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 8 },
  campBadgeGreen:  { backgroundColor: "#D1FAE5" },
  campBadgeRed:    { backgroundColor: "#FEE2E2" },
  campBadgeOrange: { backgroundColor: "#FEF3C7" },
  campBadgeText:   { fontSize: 11, fontWeight: "600", color: "#5C4033" },
  campDeadline:    { fontSize: 12, color: "#E8734A", fontWeight: "600", marginBottom: 3 },
  campDates:       { fontSize: 12, color: "#A0856B", marginBottom: 8 },
  campActions:     { flexDirection: "row", gap: 8, marginTop: 8, alignItems: "center" },
  campNoLink:      { fontSize: 12, color: "#A0856B", fontStyle: "italic" },
  emptyState:      { alignItems: "center", paddingVertical: 40 },
  emptyIcon:       { fontSize: 40, color: "#4A9E6B", marginBottom: 8 },
  emptyTitle:      { fontSize: 18, fontWeight: "700", color: "#8B4513" },
  emptySub:        { fontSize: 13, color: "#A0856B", marginTop: 4, textAlign: "center" },
  replyCard:       { backgroundColor: "#F5E6D3", borderRadius: 12, padding: 14, marginBottom: 12 },
  replyText:       { color: "#5C4033", fontSize: 14, lineHeight: 20 },
  dismiss:         { color: "#A0856B", fontSize: 12, marginTop: 8, alignSelf: "flex-end" },
  recordingBar:    { flexDirection: "row", backgroundColor: "#FFF0E8", borderRadius: 12, padding: 12,
                     marginBottom: 8, alignItems: "center", borderWidth: 1.5, borderColor: "#E8734A" },
  recordingText:   { color: "#E8734A", fontWeight: "600", fontSize: 14 },
  inputRow:        { flexDirection: "row", alignItems: "flex-end", backgroundColor: "#fff",
                     borderRadius: 24, borderWidth: 1, borderColor: "#E8E8E8",
                     paddingHorizontal: 12, paddingVertical: 6, elevation: 2 },
  input:           { flex: 1, fontSize: 14, color: "#333", paddingVertical: 8, maxHeight: 100 },
  micBtn:          { padding: 8 },
  sendBtn:         { backgroundColor: "#E8734A", borderRadius: 20, width: 34, height: 34,
                     alignItems: "center", justifyContent: "center", marginLeft: 4 },
  modalOverlay:    { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 24 },
  modalBox:        { backgroundColor: "#FFF8F0", borderRadius: 20, padding: 24 },
  modalTitle:      { fontSize: 18, fontWeight: "800", color: "#8B4513", marginBottom: 16 },
  modalInput:      { backgroundColor: "#fff", borderRadius: 12, padding: 14, fontSize: 14,
                     color: "#5C4033", borderWidth: 1, borderColor: "#F5E6D3",
                     minHeight: 120, textAlignVertical: "top", marginBottom: 16 },
});
