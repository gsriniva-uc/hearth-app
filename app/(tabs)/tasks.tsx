import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, Linking, RefreshControl,
  ActivityIndicator, Modal, TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { useAuth } from "@/app/_layout";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
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
  const [chatInput,   setChatInput]   = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [patternPreview, setPatternPreview] = useState<any | null>(null);
  const [showPatternPreview, setShowPatternPreview] = useState(false);
  const [isRecording,  setIsRecording]  = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [showPlusSheet, setShowPlusSheet] = useState(false);
  const recordingRef = useRef<any>(null);

  const load = useCallback(async () => {
    if (!USER_ID) { setLoading(false); return; }
    try {
      const [taskRes, campRes] = await Promise.all([
        fetch(`${API_BASE_URL}/tasks?user_id=${USER_ID}`),
        fetch(`${API_BASE_URL}/camps?user_id=${USER_ID}`),
      ]);
      const taskData = await taskRes.json();
      const campData = await campRes.json();
      setTasks(Array.isArray(taskData) ? taskData : []);
      setCamps(Array.isArray(campData) ? campData : []);
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

  // ── Voice recording ───────────────────────────────────────────────────────
  async function startRecording() {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) { Alert.alert("Permission needed", "Please allow microphone access."); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      setIsRecording(true);
    } catch { Alert.alert("Error", "Could not start recording."); }
  }

  async function stopRecording() {
    if (!recordingRef.current) return;
    setIsRecording(false);
    setIsTranscribing(true);
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      if (uri) {
        const b64 = await FileSystem.readAsStringAsync(uri, { encoding: "base64" });
        const res = await fetch(`${API_BASE_URL}/transcribe?user_id=${USER_ID}`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audio: b64 }),
        });
        const data = await res.json();
        if (data.transcript) setChatInput(data.transcript);
      }
    } catch (e) { console.error(e); }
    finally { setIsTranscribing(false); }
  }

  async function handleMicPress() {
    if (isRecording) await stopRecording();
    else await startRecording();
  }

  async function handleCamera() {
    setShowPlusSheet(false);
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) return;
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.7, base64: true });
    if (!result.canceled && result.assets[0]?.base64) {
      await analyzeForPattern(result.assets[0].base64, "image/jpeg");
    }
  }

  async function handlePhotos() {
    setShowPlusSheet(false);
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7, base64: true });
    if (!result.canceled && result.assets[0]?.base64) {
      await analyzeForPattern(result.assets[0].base64, "image/jpeg");
    }
  }

  async function analyzeForPattern(base64: string, mimeType: string) {
    setShowPlusSheet(false);
    setChatLoading(true);
    try {
      const res  = await fetch(`${API_BASE_URL}/analyze-pattern`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: USER_ID, image: base64, mime_type: mimeType }),
      });
      const data = await res.json();
      if (data.pattern) {
        setPatternPreview(data.pattern);
        setShowPatternPreview(true);
      } else {
        Alert.alert("Nothing found", "Could not extract a reminder pattern from this image.");
      }
    } catch { Alert.alert("Error", "Could not analyze image."); }
    finally { setChatLoading(false); }
  }

  async function handlePatternChat() {
    if (!chatInput.trim()) return;
    setChatLoading(true);
    try {
      const res  = await fetch(`${API_BASE_URL}/parse-pattern`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: USER_ID, text: chatInput.trim() }),
      });
      const data = await res.json();
      if (data.pattern) {
        setPatternPreview(data.pattern);
        setShowPatternPreview(true);
        setChatInput("");
      } else {
        Alert.alert("Could not understand", "Try: 'Remind me to refill Emma\'s prescription with CVS every 30 days'");
      }
    } catch { Alert.alert("Error", "Could not process request."); }
    finally { setChatLoading(false); }
  }

  async function confirmPattern() {
    if (!patternPreview) return;
    try {
      await fetch(`${API_BASE_URL}/patterns/manual`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: USER_ID, ...patternPreview }),
      });
      setShowPatternPreview(false);
      setPatternPreview(null);
      load();
      Alert.alert("Saved", "Reminder pattern added. Draft will appear when due.");
    } catch { Alert.alert("Error", "Could not save pattern."); }
  }

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

        {/* Summer Camps */}
        {camps.length > 0 && (
          <>
            <Text style={styles.section}>🏕️ CAMPS & ACTIVITIES</Text>
            {Object.entries(
              camps.reduce((acc: any, c: any) => {
                const key = c.child_name || "Family";
                if (!acc[key]) acc[key] = [];
                acc[key].push(c);
                return acc;
              }, {})
            ).map(([child, childCamps]: [string, any]) => (
              <View key={child}>
                <Text style={campCardStyles.childHeader}>{child}</Text>
                {childCamps.map((camp: any) => {
                  const isUrgent = camp.registration_deadline &&
                    new Date(camp.registration_deadline) <= new Date(Date.now() + 3 * 86400000);
                  const isPast   = camp.registration_deadline &&
                    new Date(camp.registration_deadline) < new Date();
                  return (
                    <View key={camp.id} style={[campCardStyles.card,
                      isUrgent && camp.status === "pending" && campCardStyles.cardUrgent]}>
                      <View style={campCardStyles.row}>
                        <Text style={campCardStyles.name}>{camp.camp_name}</Text>
                        <Text style={[campCardStyles.badge,
                          camp.status === "registered" && campCardStyles.badgeGreen,
                          camp.status === "missed"     && campCardStyles.badgeRed]}>
                          {camp.status === "registered" ? "✅ Registered"
                           : camp.status === "missed"   ? "❌ Missed"
                           : isPast                     ? "⚠️ Deadline passed"
                           : "Pending"}
                        </Text>
                      </View>
                      {camp.registration_deadline && (
                        <Text style={campCardStyles.deadline}>
                          📅 Register by {camp.registration_deadline}
                        </Text>
                      )}
                      {(camp.camp_start_date || camp.camp_end_date) && (
                        <Text style={campCardStyles.dates}>
                          🗓️ {camp.camp_start_date} → {camp.camp_end_date}
                        </Text>
                      )}
                      <View style={campCardStyles.actions}>
                        {camp.registration_url ? (
                          <TouchableOpacity style={campCardStyles.linkBtn}
                            onPress={() => Linking.openURL(camp.registration_url)}>
                            <Text style={campCardStyles.linkBtnText}>Register →</Text>
                          </TouchableOpacity>
                        ) : (
                          <Text style={campCardStyles.noLink}>🔍 Searching for link...</Text>
                        )}
                        {camp.status === "pending" && (
                          <TouchableOpacity style={campCardStyles.doneBtn}
                            onPress={async () => {
                              await fetch(`${API_BASE_URL}/camps/${camp.id}/status`, {
                                method: "PUT",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ user_id: USER_ID, status: "registered" }),
                              });
                              load();
                            }}>
                            <Text style={campCardStyles.doneBtnText}>Mark Registered</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            ))}
          </>
        )}

        {/* Add Pattern Chat Bar */}
        <Text style={styles.section}>➕ ADD REMINDER PATTERN</Text>
        <View style={styles.inputBar}>
          <TouchableOpacity style={styles.plusBtn}
            onPress={() => setShowPlusSheet(true)}>
            <Ionicons name="add" size={22} color="#666" />
          </TouchableOpacity>
          <TextInput
            style={styles.inputField}
            placeholder="e.g. Remind me to refill Emma's Adderall with CVS every 30 days..."
            placeholderTextColor="#A0856B"
            value={chatInput}
            onChangeText={setChatInput}
            onSubmitEditing={handlePatternChat}
            returnKeyType="send"
            multiline
          />
          <TouchableOpacity style={styles.micBtn}
            onPress={handleMicPress} disabled={isTranscribing}>
            {isTranscribing
              ? <ActivityIndicator size="small" color="#E8734A" />
              : <Ionicons name={isRecording ? "stop-circle" : "mic"}
                  size={20} color={isRecording ? "#E8734A" : "#666"} />}
          </TouchableOpacity>
          {chatInput.trim() ? (
            <TouchableOpacity style={styles.sendBtn}
              onPress={handlePatternChat} disabled={chatLoading}>
              {chatLoading
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="arrow-up" size={18} color="#fff" />}
            </TouchableOpacity>
          ) : null}
        </View>
        <Text style={styles.voiceHint}>
          Tap 🎙️ to speak or type a reminder pattern
        </Text>

      </ScrollView>

      {/* Plus sheet */}
      <Modal visible={showPlusSheet} transparent animationType="slide">
        <TouchableOpacity style={styles.sheetBackdrop}
          onPress={() => setShowPlusSheet(false)} activeOpacity={1}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Add from image</Text>
            <View style={styles.sheetGrid}>
              <TouchableOpacity style={styles.sheetItem} onPress={handleCamera}>
                <View style={styles.sheetIconBox}>
                  <Ionicons name="camera" size={28} color="#5C4033" />
                </View>
                <Text style={styles.sheetItemLabel}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sheetItem} onPress={handlePhotos}>
                <View style={styles.sheetIconBox}>
                  <Ionicons name="image" size={28} color="#5C4033" />
                </View>
                <Text style={styles.sheetItemLabel}>Photos</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sheetItem} onPress={async () => {
                setShowPlusSheet(false);
                const result = await DocumentPicker.getDocumentAsync({
                  type: ["application/pdf","image/*"], copyToCacheDirectory: true });
                if (!result.canceled) {
                  const file = result.assets[0];
                  const b64  = await FileSystem.readAsStringAsync(file.uri, { encoding: "base64" });
                  await analyzeForPattern(b64, file.mimeType || "application/pdf");
                }
              }}>
                <View style={styles.sheetIconBox}>
                  <Ionicons name="document-attach" size={28} color="#5C4033" />
                </View>
                <Text style={styles.sheetItemLabel}>Files</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Pattern preview modal */}
      <Modal visible={showPatternPreview} transparent animationType="slide">
        <View style={styles.previewOverlay}>
          <View style={styles.previewBox}>
            <Text style={styles.previewTitle}>Does this look right?</Text>
            {patternPreview && (
              <View style={styles.previewContent}>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Type</Text>
                  <Text style={styles.previewValue}>{patternPreview.pattern_type}</Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>For</Text>
                  <Text style={styles.previewValue}>{patternPreview.child_name || "Family"}</Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Contact</Text>
                  <Text style={styles.previewValue}>{patternPreview.contact_name || "—"}</Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Email</Text>
                  <Text style={styles.previewValue}>{patternPreview.contact_email || "—"}</Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Every</Text>
                  <Text style={styles.previewValue}>{patternPreview.frequency_days} days</Text>
                </View>
                <View style={[styles.previewRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.previewLabel}>Notes</Text>
                  <Text style={styles.previewValue}>{patternPreview.keywords || "—"}</Text>
                </View>
              </View>
            )}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={[styles.confirmBtn, { flex: 1 }]}
                onPress={confirmPattern}>
                <Text style={styles.confirmBtnText}>Save Pattern</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.cancelPreviewBtn, { flex: 1 }]}
                onPress={() => setShowPatternPreview(false)}>
                <Text style={styles.cancelPreviewText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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

  // Chat bar
  inputBar:      { flexDirection: "row", alignItems: "flex-end",
                   backgroundColor: "#fff", borderRadius: 24,
                   borderWidth: 1, borderColor: "#E8E8E8",
                   paddingHorizontal: 8, paddingVertical: 6,
                   marginTop: 8, elevation: 2 },
  plusBtn:       { padding: 8, marginBottom: 2 },
  inputField:    { flex: 1, fontSize: 14, color: "#333",
                   paddingHorizontal: 4, paddingVertical: 8, maxHeight: 80 },
  micBtn:        { padding: 8, marginBottom: 2 },
  sendBtn:       { backgroundColor: "#E8734A", borderRadius: 20,
                   width: 34, height: 34, alignItems: "center",
                   justifyContent: "center", marginBottom: 2 },
  voiceHint:     { fontSize: 11, color: "#C0A090", marginTop: 6,
                   textAlign: "center", fontStyle: "italic" },

  // Plus sheet
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet:         { backgroundColor: "#fff", borderTopLeftRadius: 24,
                   borderTopRightRadius: 24, padding: 24, paddingBottom: 60, minHeight: 240 },
  sheetHandle:   { width: 40, height: 4, backgroundColor: "#E0E0E0",
                   borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  sheetTitle:    { fontSize: 16, fontWeight: "700", color: "#333", marginBottom: 20 },
  sheetGrid:     { flexDirection: "row", gap: 16 },
  sheetItem:     { alignItems: "center", gap: 8 },
  sheetIconBox:  { width: 60, height: 60, borderRadius: 16,
                   backgroundColor: "#F5F5F5", alignItems: "center",
                   justifyContent: "center" },
  sheetItemLabel:{ fontSize: 13, color: "#333", fontWeight: "500" },

  // Pattern preview
  previewOverlay:  { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  previewBox:      { backgroundColor: "#FFF8F0", borderTopLeftRadius: 24,
                     borderTopRightRadius: 24, padding: 24 },
  previewTitle:    { fontSize: 18, fontWeight: "800", color: "#8B4513", marginBottom: 16 },
  previewContent:  { backgroundColor: "#fff", borderRadius: 14, overflow: "hidden",
                     borderWidth: 1, borderColor: "#F5E6D3" },
  previewRow:      { flexDirection: "row", padding: 12,
                     borderBottomWidth: 0.5, borderBottomColor: "#F5E6D3" },
  previewLabel:    { width: 70, fontSize: 13, color: "#A0856B", fontWeight: "600" },
  previewValue:    { flex: 1, fontSize: 13, color: "#5C4033" },
  confirmBtn:      { backgroundColor: "#E8734A", borderRadius: 12,
                     paddingVertical: 14, alignItems: "center" },
  confirmBtnText:  { color: "#fff", fontWeight: "700", fontSize: 15 },
  cancelPreviewBtn:{ borderWidth: 1.5, borderColor: "#C0A090", borderRadius: 12,
                     paddingVertical: 14, alignItems: "center" },
  cancelPreviewText:{ color: "#A0856B", fontWeight: "600", fontSize: 15 },
});

const campCardStyles = StyleSheet.create({
  childHeader: { fontSize: 13, fontWeight: "700", color: "#A0856B", letterSpacing: 0.5, marginBottom: 6, marginTop: 4 },
  card:        { backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#F5E6D3", elevation: 2 },
  cardUrgent:  { borderColor: "#E8734A", borderWidth: 1.5 },
  row:         { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 },
  name:        { fontSize: 15, fontWeight: "700", color: "#5C4033", flex: 1 },
  badge:       { fontSize: 11, color: "#A0856B", backgroundColor: "#F5E6D3", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeGreen:  { backgroundColor: "#D1FAE5", color: "#065F46" },
  badgeRed:    { backgroundColor: "#FEE2E2", color: "#991B1B" },
  deadline:    { fontSize: 12, color: "#E8734A", marginBottom: 3, fontWeight: "600" },
  dates:       { fontSize: 12, color: "#A0856B", marginBottom: 8 },
  actions:     { flexDirection: "row", gap: 8, marginTop: 4 },
  linkBtn:     { backgroundColor: "#E8734A", borderRadius: 10, paddingVertical: 7, paddingHorizontal: 14 },
  linkBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  noLink:      { fontSize: 12, color: "#A0856B", fontStyle: "italic", paddingVertical: 7 },
  doneBtn:     { borderWidth: 1, borderColor: "#4A9E6B", borderRadius: 10, paddingVertical: 7, paddingHorizontal: 14 },
  doneBtnText: { color: "#4A9E6B", fontWeight: "600", fontSize: 13 },
});
