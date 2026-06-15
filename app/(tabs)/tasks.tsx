import { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, RefreshControl, ActivityIndicator, TextInput,
  Modal, Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/app/_layout";
import { API_BASE_URL } from "@/constants/config";

export default function TasksScreen() {
  const { user } = useAuth();
  const USER_ID  = user?.user_id || "";

  const [items,        setItems]        = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [briefingTime, setBriefingTime] = useState("");
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
    // Show cache instantly
    try {
      const cached = await AsyncStorage.getItem("briefing_" + USER_ID);
      if (cached) {
        const p = JSON.parse(cached);
        setItems(p.items || []);
        setBriefingTime(p.time || "");
        setLoading(false);
      }
    } catch {}
    // Fetch fresh in background
    try {
      const res  = await fetch(`${API_BASE_URL}/actions/briefing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: USER_ID }),
      });
      const data = await res.json();
      const freshItems = Array.isArray(data.items) ? data.items : [];
      const freshTime  = new Date().toLocaleTimeString("en-US",
        { hour: "numeric", minute: "2-digit" });
      setItems(freshItems);
      setBriefingTime(freshTime);
      await AsyncStorage.setItem("briefing_" + USER_ID,
        JSON.stringify({ items: freshItems, time: freshTime }));
    } catch (e) { console.error("briefing:", e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [USER_ID]);

  useEffect(() => { load(); }, [load]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await fetch(`${API_BASE_URL}/gmail/scan-all?user_id=${USER_ID}`, { method: "POST" });
      await fetch(`${API_BASE_URL}/tasks/scan?user_id=${USER_ID}`, { method: "POST" });
    } catch (e) { console.error(e); }
    await load();
  }

  const [showMissedModal, setShowMissedModal] = useState(false);
  const [missedTitle,      setMissedTitle]      = useState("");
  const [missedType,       setMissedType]       = useState<"school_task"|"bill"|"event">("school_task");
  const [missedDueDate,    setMissedDueDate]    = useState("");
  const [missedNotes,      setMissedNotes]      = useState("");
  const [missedSaving,     setMissedSaving]     = useState(false);

  async function handleSubmitMissed() {
    if (!missedTitle.trim()) return;
    setMissedSaving(true);
    try {
      await fetch(`${API_BASE_URL}/feedback/missed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: USER_ID,
          item_type: missedType,
          title: missedTitle.trim(),
          due_date: missedDueDate.trim() || null,
          notes: missedNotes.trim() || null,
        }),
      });
      setMissedTitle(""); setMissedDueDate(""); setMissedNotes("");
      setMissedType("school_task");
      setShowMissedModal(false);
      await load();
    } catch (e) { console.error(e); }
    finally { setMissedSaving(false); }
  }

  async function handleFeedback(item: any, thumbs: "up" | "down") {
    try {
      await fetch(`${API_BASE_URL}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: USER_ID,
          item_type: item.item_type,
          item_id: item.item_id,
          title: item.title,
          contact_name: item.contact_name || null,
          thumbs,
        }),
      });
      if (thumbs === "down") {
        await load();
      }
    } catch (e) { console.error(e); }
  }

  async function handleCheckStatus(item: any) {
    try {
      await fetch(`${API_BASE_URL}/camps/${item.item_id}/check-status?user_id=${USER_ID}`, {
        method: "POST",
      });
      await load();
    } catch (e) { console.error(e); }
  }

  async function handleMarkDone(item: any) {
    try {
      if (item.item_type === "camp") {
        await fetch(`${API_BASE_URL}/camps/${item.item_id}/dismiss-action?user_id=${USER_ID}`, {
          method: "POST",
        });
        await fetch(`${API_BASE_URL}/camps/${item.item_id}/check-status?user_id=${USER_ID}`, {
          method: "POST",
        });
      } else {
        await fetch(`${API_BASE_URL}/tasks/${item.item_id}/done?user_id=${USER_ID}`, {
          method: "POST",
        });
      }
      await load();
    } catch (e) { console.error(e); }
  }

  async function handleAction(item: any) {
    if (item.deep_link_url) {
      try { await Linking.openURL(item.deep_link_url); return; } catch {}
    }
    if (item.action_url) {
      await Linking.openURL(item.action_url);
      return;
    }
    if (item.action_label === "Draft Email") {
      const res  = await fetch(`${API_BASE_URL}/tasks?user_id=${USER_ID}`);
      const tasks = await res.json();
      const task  = Array.isArray(tasks)
        ? tasks.find((t: any) => t.id === item.item_id)
        : null;
      if (task) { setEditTask(task); setEditBody(task.draft_body || ""); setShowEdit(true); }
    }
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

  const urgencyColor = (u: string) => {
    if (u === "high")   return "#E84A4A";
    if (u === "medium") return "#E8734A";
    return "#A0856B";
  };

  const urgencyIcon = (u: string) => {
    if (u === "high")   return "⚠️";
    if (u === "medium") return "📋";
    return "ℹ️";
  };

  if (loading) return (
    <View style={s.center}><ActivityIndicator size="large" color="#E8734A" /></View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#FFF8F0" }}>
      <ScrollView contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>

        <View style={s.headerRow}>
          <Text style={s.title}>Actions</Text>
          <TouchableOpacity style={s.refreshBtn} onPress={handleRefresh} disabled={refreshing}>
            {refreshing
              ? <ActivityIndicator size="small" color="#E8734A" />
              : <>
                  <Ionicons name="refresh" size={14} color="#E8734A" />
                  <Text style={s.refreshText}>Refresh</Text>
                </>}
          </TouchableOpacity>
        </View>

        {briefingTime
          ? <Text style={s.updated}>Updated {briefingTime}</Text>
          : null}

        {items.length === 0
          ? <View style={s.allClear}>
              <Text style={s.allClearIcon}>✓</Text>
              <Text style={s.allClearTitle}>All caught up</Text>
              <Text style={s.allClearSub}>No actions needed right now</Text>
            </View>
          : items.map((item, i) => (
            <View key={i} style={[s.card,
              item.urgency === "high"   && s.cardHigh,
              item.urgency === "medium" && s.cardMedium]}>
              <View style={s.cardRow}>
                <Text style={s.urgencyIcon}>{urgencyIcon(item.urgency)}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[s.cardTitle,
                    item.urgency === "high" && { color: "#C0392B" }]}>
                    {item.title}
                  </Text>
                  {item.subtitle
                    ? <Text style={s.cardSub}>{item.subtitle}</Text>
                    : null}
                  {item.action_label
                    ? <View style={s.btnRow}>
                        <TouchableOpacity
                          style={[s.actionBtn,
                            item.app_name && s.actionBtnApp]}
                          onPress={() => handleAction(item)}>
                          <Text style={s.actionBtnText}>
                            {item.app_name
                              ? `Open ${item.app_name}`
                              : item.action_label}
                          </Text>
                        </TouchableOpacity>
                        {item.item_type === "camp"
                          ? <TouchableOpacity
                              style={s.checkStatusBtn}
                              onPress={() => handleCheckStatus(item)}>
                              <Text style={s.checkStatusText}>Check status</Text>
                            </TouchableOpacity>
                          : null}
                        <TouchableOpacity
                          style={s.markDoneBtn}
                          onPress={() => handleMarkDone(item)}>
                          <Text style={s.markDoneText}>✓ Mark done</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={s.thumbBtn}
                          onPress={() => handleFeedback(item, "up")}>
                          <Text style={s.thumbText}>👍</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={s.thumbBtn}
                          onPress={() => handleFeedback(item, "down")}>
                          <Text style={s.thumbText}>👎</Text>
                        </TouchableOpacity>
                      </View>
                    : null}
                </View>
              </View>
            </View>
          ))
        }

        <Text style={s.section}>➕ ADD REMINDER</Text>
        {chatReply
          ? <View style={s.replyCard}>
              <Text style={s.replyText}>{chatReply}</Text>
              <TouchableOpacity onPress={() => setChatReply("")}>
                <Text style={s.dismiss}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          : null}
        <TouchableOpacity style={s.addMissedBtn} onPress={() => setShowMissedModal(true)}>
          <Ionicons name="add-circle-outline" size={18} color="#A0856B" />
          <Text style={s.addMissedText}>Add something Hearth missed</Text>
        </TouchableOpacity>

        {isRecording
          ? <View style={s.recordingBar}>
              <Text style={s.recordingText}>🎙️ Recording... tap mic to stop</Text>
            </View>
          : null}
        {isTranscribing
          ? <View style={s.recordingBar}>
              <ActivityIndicator size="small" color="#E8734A" />
              <Text style={s.recordingText}>  Transcribing...</Text>
            </View>
          : null}
        <View style={s.inputRow}>
          <TextInput
            style={s.input}
            placeholder="e.g. Remind me to refill prescription every 30 days"
            placeholderTextColor="#A0856B"
            value={chatInput}
            onChangeText={setChatInput}
            multiline
          />
          <TouchableOpacity style={s.micBtn} onPress={handleMic}>
            <Ionicons name={isRecording ? "stop-circle" : "mic"} size={20}
              color={isRecording ? "#E84A4A" : "#A0856B"} />
          </TouchableOpacity>
          {chatInput.trim()
            ? <TouchableOpacity style={s.sendBtn}
                onPress={() => handleSend(chatInput)} disabled={chatLoading}>
                {chatLoading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="arrow-up" size={18} color="#fff" />}
              </TouchableOpacity>
            : null}
        </View>

      </ScrollView>

      <Modal visible={showMissedModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Add something Hearth missed</Text>

            <TextInput style={s.modalInput}
              placeholder="What needs to happen? e.g. Submit science fair registration"
              placeholderTextColor="#A0856B"
              value={missedTitle} onChangeText={setMissedTitle} multiline />

            <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
              {(["school_task","bill","event"] as const).map(t => (
                <TouchableOpacity key={t}
                  style={[s.typeChip, missedType === t && s.typeChipActive]}
                  onPress={() => setMissedType(t)}>
                  <Text style={[s.typeChipText, missedType === t && s.typeChipTextActive]}>
                    {t === "school_task" ? "School task" : t === "bill" ? "Bill" : "Event"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput style={s.modalInput}
              placeholder="Due date (YYYY-MM-DD, optional)"
              placeholderTextColor="#A0856B"
              value={missedDueDate} onChangeText={setMissedDueDate} />

            <TextInput style={[s.modalInput, { minHeight: 60 }]}
              placeholder="What was this about? (e.g. email from Lincoln Elementary)"
              placeholderTextColor="#A0856B"
              value={missedNotes} onChangeText={setMissedNotes} multiline />

            <TouchableOpacity style={s.saveBtn}
              onPress={handleSubmitMissed} disabled={missedSaving || !missedTitle.trim()}>
              {missedSaving
                ? <ActivityIndicator color="#fff" />
                : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Add</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => {
                setShowMissedModal(false);
                setMissedTitle(""); setMissedDueDate(""); setMissedNotes("");
                setMissedType("school_task");
              }} style={{ alignItems: "center", marginTop: 12 }}>
              <Text style={{ color: "#A0856B" }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showEdit} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Edit Draft</Text>
            <TextInput
              style={s.modalInput}
              value={editBody}
              onChangeText={setEditBody}
              multiline
              numberOfLines={6}
            />
            <TouchableOpacity style={s.saveBtn} onPress={async () => {
              await fetch(`${API_BASE_URL}/tasks/${editTask?.id}/draft?user_id=${USER_ID}`, {
                method: "PUT", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ body: editBody, subject: editTask?.draft_subject, to: editTask?.draft_to }),
              });
              setShowEdit(false); await load();
            }}>
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowEdit(false)}
              style={{ alignItems: "center", marginTop: 12 }}>
              <Text style={{ color: "#A0856B" }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  center:        { flex: 1, alignItems: "center", justifyContent: "center" },
  content:       { padding: 20, paddingTop: 60, paddingBottom: 60 },
  headerRow:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  title:         { fontSize: 26, fontWeight: "800", color: "#8B4513" },
  refreshBtn:    { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1,
                   borderColor: "#E8734A", borderRadius: 8, paddingVertical: 5, paddingHorizontal: 10 },
  refreshText:   { fontSize: 12, color: "#E8734A", fontWeight: "600" },
  updated:       { fontSize: 11, color: "#C0A090", marginBottom: 16 },
  card:          { backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 8,
                   borderWidth: 0.5, borderColor: "#F5E6D3", elevation: 1 },
  cardHigh:      { borderColor: "#E84A4A", borderWidth: 1.5 },
  cardMedium:    { borderColor: "#E8734A", borderWidth: 1 },
  cardRow:       { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  urgencyIcon:   { fontSize: 18, marginTop: 1 },
  cardTitle:     { fontSize: 14, fontWeight: "700", color: "#5C4033", marginBottom: 3 },
  cardSub:       { fontSize: 12, color: "#A0856B", marginBottom: 8, lineHeight: 16 },
  btnRow:        { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  actionBtn:     { backgroundColor: "#E8734A", borderRadius: 8,
                   paddingVertical: 6, paddingHorizontal: 14 },
  actionBtnApp:  { backgroundColor: "#4A7BE8" },
  checkStatusBtn:{ borderWidth: 1, borderColor: "#A0856B", borderRadius: 8,
                   paddingVertical: 6, paddingHorizontal: 10 },
  checkStatusText:{ color: "#A0856B", fontWeight: "600", fontSize: 12 },
  markDoneBtn:   { borderWidth: 1, borderColor: "#4A9E6B", borderRadius: 8,
                   paddingVertical: 6, paddingHorizontal: 10 },
  markDoneText:  { color: "#4A9E6B", fontWeight: "600", fontSize: 12 },
  thumbBtn:      { borderWidth: 1, borderColor: "#E8E8E8", borderRadius: 8,
                   paddingVertical: 6, paddingHorizontal: 10 },
  thumbText:     { fontSize: 14 },
  actionBtnText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  allClear:      { alignItems: "center", paddingVertical: 60 },
  allClearIcon:  { fontSize: 48, color: "#4A9E6B", marginBottom: 8 },
  allClearTitle: { fontSize: 20, fontWeight: "700", color: "#8B4513" },
  allClearSub:   { fontSize: 14, color: "#A0856B", marginTop: 4 },
  section:       { fontSize: 11, fontWeight: "700", color: "#A0856B",
                   letterSpacing: 1.5, marginTop: 24, marginBottom: 10 },
  replyCard:     { backgroundColor: "#F5E6D3", borderRadius: 12, padding: 14, marginBottom: 12 },
  replyText:     { color: "#5C4033", fontSize: 14, lineHeight: 20 },
  dismiss:       { color: "#A0856B", fontSize: 12, marginTop: 8, alignSelf: "flex-end" },
  recordingBar:  { flexDirection: "row", backgroundColor: "#FFF0E8", borderRadius: 12,
                   padding: 12, marginBottom: 8, alignItems: "center",
                   borderWidth: 1.5, borderColor: "#E8734A" },
  recordingText: { color: "#E8734A", fontWeight: "600", fontSize: 14 },
  inputRow:      { flexDirection: "row", alignItems: "flex-end", backgroundColor: "#fff",
                   borderRadius: 24, borderWidth: 1, borderColor: "#E8E8E8",
                   paddingHorizontal: 12, paddingVertical: 6, elevation: 2 },
  input:         { flex: 1, fontSize: 14, color: "#333", paddingVertical: 8, maxHeight: 100 },
  micBtn:        { padding: 8 },
  sendBtn:       { backgroundColor: "#E8734A", borderRadius: 20, width: 34, height: 34,
                   alignItems: "center", justifyContent: "center", marginLeft: 4 },
  modalOverlay:  { flex: 1, backgroundColor: "rgba(0,0,0,0.5)",
                   justifyContent: "center", padding: 24 },
  modalBox:      { backgroundColor: "#FFF8F0", borderRadius: 20, padding: 24 },
  modalTitle:    { fontSize: 18, fontWeight: "800", color: "#8B4513", marginBottom: 16 },
  modalInput:    { backgroundColor: "#fff", borderRadius: 12, padding: 14, fontSize: 14,
                   color: "#5C4033", borderWidth: 1, borderColor: "#F5E6D3",
                   minHeight: 120, textAlignVertical: "top", marginBottom: 16 },
  saveBtn:       { backgroundColor: "#E8734A", borderRadius: 12, padding: 16, alignItems: "center" },
  addMissedBtn:  { flexDirection: "row", alignItems: "center", gap: 8,
                   borderWidth: 1.5, borderColor: "#E8E8E8", borderStyle: "dashed",
                   borderRadius: 12, padding: 14, justifyContent: "center", marginTop: 8 },
  addMissedText: { color: "#A0856B", fontWeight: "600", fontSize: 14 },
  typeChip:      { flex: 1, borderWidth: 1, borderColor: "#E8E8E8", borderRadius: 10,
                   paddingVertical: 8, alignItems: "center" },
  typeChipActive:{ borderColor: "#E8734A", backgroundColor: "#FFF0E8" },
  typeChipText:  { fontSize: 12, color: "#5C4033", fontWeight: "600" },
  typeChipTextActive: { color: "#E8734A" },
});
