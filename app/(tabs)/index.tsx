import { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, StyleSheet,
  RefreshControl, Alert, Modal, KeyboardAvoidingView, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Swipeable, GestureHandlerRootView } from "react-native-gesture-handler";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { useAuth } from "@/app/_layout";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "@/constants/config";

const SCHOOL_TYPES  = ["dress_down_day","early_dismissal","recital","field_trip",
                       "special_day","school_holiday","activity","sports_game","other"];
const HEALTH_TYPES  = ["doctor_appointment"];
const BILL_TYPES    = ["bill"];

export default function TodayScreen() {
  const { user, signOut } = useAuth();
  const USER_ID = user?.user_id || "";

  const router = useRouter();
  const [todayEvents,    setTodayEvents]    = useState<any[]>([]);
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [walkthroughStep, setWalkthroughStep] = useState(0);
  const [checklistDone,   setChecklistDone]   = useState({ child: false, scan: false });
  const [showChecklist,   setShowChecklist]   = useState(false);
  const [chatInput,      setChatInput]      = useState("");
  const [chatReply,      setChatReply]      = useState("");
  const [loading,        setLoading]        = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);
  const [chatLoading,    setChatLoading]    = useState(false);
  const [isRecording,    setIsRecording]    = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [showPlusSheet,  setShowPlusSheet]  = useState(false);
  const [analyzing,      setAnalyzing]      = useState(false);
  const [previewItems,   setPreviewItems]   = useState<any[]>([]);
  const [showPreview,    setShowPreview]    = useState(false);

  const recordingRef    = useRef<Audio.Recording | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadData = useCallback(async () => {
    if (!USER_ID) { setLoading(false); return; }
    try {
      const res  = await fetch(`${API_BASE_URL}/events/today?user_id=${USER_ID}`);
      const data = await res.json();
      setTodayEvents(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [USER_ID]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    async function checkOnboarding() {
      if (!USER_ID) return;
      try {
        setWalkthroughStep(0);
        setShowWalkthrough(true);
        // Check checklist status
        const profilesRes = await fetch(`${API_BASE_URL}/profiles?user_id=${USER_ID}`);
        const profiles    = await profilesRes.json();
        const hasChild    = Array.isArray(profiles) && profiles.length > 0;
        const eventsRes   = await fetch(`${API_BASE_URL}/events?user_id=${USER_ID}&days_ahead=60`);
        const events      = await eventsRes.json();
        const hasScanned  = Array.isArray(events) && events.length > 0;
        setChecklistDone({ child: hasChild, scan: hasScanned });
        setShowChecklist(!hasChild || !hasScanned);
      } catch (e) { console.error(e); }
    }
    checkOnboarding();
  }, [USER_ID]);

  function dismissWalkthrough() {
    setShowWalkthrough(false);
  }

  function nextStep() {
    if (walkthroughStep < 3) setWalkthroughStep(walkthroughStep + 1);
    else dismissWalkthrough();
  }

  // ── Recording ──────────────────────────────────────────────────────────────
  async function startRecording() {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) { Alert.alert("Permission needed", "Please allow microphone access."); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      setIsRecording(true);
      recording.setOnRecordingStatusUpdate((status) => {
        if (!status.isRecording) return;
        const volume = status.metering ?? -160;
        if (volume < -40) {
          if (!silenceTimerRef.current)
            silenceTimerRef.current = setTimeout(() => stopRecording(), 1500);
        } else {
          if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
        }
      });
      recording.setProgressUpdateInterval(100);
    } catch (e) { Alert.alert("Error", "Could not start recording."); }
  }

  async function stopRecording() {
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    if (!recordingRef.current) return;
    setIsRecording(false);
    setIsTranscribing(true);
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      if (uri) await transcribeAudio(uri);
    } catch (e) { console.error(e); }
    finally { setIsTranscribing(false); }
  }

  async function transcribeAudio(uri: string) {
    try {
      const base64Audio = await FileSystem.readAsStringAsync(uri, { encoding: "base64" });
      const res  = await fetch(`${API_BASE_URL}/transcribe?user_id=${USER_ID}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body:   JSON.stringify({ audio: base64Audio }),
      });
      const data = await res.json();
      if (data.transcript) setChatInput(data.transcript);
      else Alert.alert("Could not hear you", "Please try again.");
    } catch (e: any) { Alert.alert("Error", String(e?.message || e)); }
  }

  async function handleMicPress() {
    if (isRecording) await stopRecording();
    else await startRecording();
  }

  // ── Image analysis ─────────────────────────────────────────────────────────
  async function analyzeImage(base64: string, mimeType: string) {
    setShowPlusSheet(false);
    setAnalyzing(true);
    try {
      const res  = await fetch(`${API_BASE_URL}/analyze-image`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ user_id: USER_ID, image: base64, mime_type: mimeType }),
      });
      const data = await res.json();
      if (data.items && data.items.length > 0) {
        setPreviewItems(data.items.map((i: any) => ({ ...i, selected: true })));
        setShowPreview(true);
      } else {
        Alert.alert("Nothing found", "Could not extract any actionable items.");
      }
    } catch {
      Alert.alert("Error", "Could not analyze image.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleCamera() {
    setShowPlusSheet(false);
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) { Alert.alert("Permission needed", "Please allow camera access."); return; }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality:    0.7,
      base64:     true,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      await analyzeImage(result.assets[0].base64, "image/jpeg");
    }
  }

  async function handlePhotos() {
    setShowPlusSheet(false);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality:    0.7,
      base64:     true,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      await analyzeImage(result.assets[0].base64, "image/jpeg");
    }
  }

  async function handleFiles() {
    setShowPlusSheet(false);
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*"],
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const file = result.assets[0];
    const b64  = await FileSystem.readAsStringAsync(file.uri, { encoding: "base64" });
    await analyzeImage(b64, file.mimeType || "application/pdf");
  }

  async function confirmItems(items: any[]) {
    setShowPreview(false);
    let added = 0;
    for (const item of items) {
      if (!item.selected) continue;
      try {
        if (item.type === "event") {
          await fetch(`${API_BASE_URL}/events`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_id: USER_ID, child_name: item.child_name || "all",
              event_type: item.event_type || "other", event_date: item.event_date,
              event_time: item.event_time || null, notes: item.notes || item.title,
            }),
          });
        } else {
          await fetch(`${API_BASE_URL}/tasks`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_id: USER_ID, task_type: item.task_type || "bill",
              title: item.title, due_date: item.due_date || null,
              amount: item.amount || null, payment_url: item.payment_url || null,
              contact_name: item.contact_name || null,
              draft_to: item.draft_to || null, draft_subject: item.draft_subject || null,
              draft_body: item.draft_body || null,
            }),
          });
        }
        added++;
      } catch (e) { console.error(e); }
    }
    loadData();
    Alert.alert("Done", added + " item(s) added.");
  }

  // ── Chat ───────────────────────────────────────────────────────────────────
  async function handleDelete(eventId: number) {
    try {
      await fetch(`${API_BASE_URL}/events/${eventId}?user_id=${USER_ID}`,
                  { method: "DELETE" });
      loadData();
    } catch (e) { console.error(e); }
  }

  async function handleChat() {
    if (!chatInput.trim() || !USER_ID) return;
    setChatLoading(true);
    try {
      const res  = await fetch(`${API_BASE_URL}/agent`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body:   JSON.stringify({ user_id: USER_ID, raw_text: chatInput.trim() }),
      });
      const data = await res.json();
      setChatReply(data.response || "");
      setChatInput("");
      // Refresh immediately and again after 2s to catch slow saves
      loadData();
      setTimeout(() => loadData(), 2000);
      if ((data.response || "").includes("✅"))
        setTimeout(() => setChatReply(""), 5000);
    } catch { Alert.alert("Error", "Could not reach Hearth."); }
    finally { setChatLoading(false); }
  }

  function handleSignOut() {
    Alert.alert("Sign out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: signOut },
    ]);
  }

  const schoolEvents = todayEvents.filter(e => SCHOOL_TYPES.includes(e.event_type));
  const healthEvents = todayEvents.filter(e => HEALTH_TYPES.includes(e.event_type));
  const billEvents   = todayEvents.filter(e => BILL_TYPES.includes(e.event_type));

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric" });

  const EventCard = ({ ev }: { ev: any }) => (
    <View style={styles.eventCard}>
      {ev.child_name !== "all" && <Text style={styles.eventChild}>{ev.child_name}</Text>}
      <Text style={styles.eventLabel}>
        {ev.notes || ev.event_type.replace(/_/g," ").replace(/\b\w/g,(c:string)=>c.toUpperCase())}
      </Text>
      {ev.event_time ? <Text style={styles.eventTime}>🕐 {ev.event_time}</Text> : null}
    </View>
  );

  if (loading) return (
    <View style={styles.center}><ActivityIndicator size="large" color="#E8734A" /></View>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <KeyboardAvoidingView style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={90}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); loadData(); }} />}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good morning 🌅</Text>
            <Text style={styles.date}>{today}</Text>
            {user && <Text style={styles.userTag}>👤 {user.name}</Text>}
          </View>
          <TouchableOpacity onPress={handleSignOut} style={styles.signOutBtn}>
            <Ionicons name="log-out-outline" size={22} color="#A0856B" />
          </TouchableOpacity>
        </View>

        {/* Checklist */}
        {showChecklist && (
          <View style={styles.checklistCard}>
            <Text style={styles.checklistTitle}>🚀 Get started with Hearth</Text>
            <Text style={styles.checklistSub}>
              {[checklistDone.child, checklistDone.scan].filter(Boolean).length + 1} of 3 steps complete
            </Text>
            <View style={styles.checkItem}>
              <View style={[styles.checkCircle, styles.checkDone]}>
                <Text style={styles.checkMark}>✓</Text>
              </View>
              <Text style={styles.checkText}>Sign in with Google</Text>
            </View>
            <TouchableOpacity style={styles.checkItem}
              onPress={() => !checklistDone.child && router.push("/(tabs)/profile")}>
              <View style={[styles.checkCircle, checklistDone.child && styles.checkDone]}>
                {checklistDone.child && <Text style={styles.checkMark}>✓</Text>}
              </View>
              <Text style={styles.checkText}>Add a child</Text>
              {!checklistDone.child && <Text style={styles.checkArrow}>→ Family</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.checkItem, { borderBottomWidth: 0 }]}
              onPress={() => !checklistDone.scan && router.push("/(tabs)/profile")}>
              <View style={[styles.checkCircle, checklistDone.scan && styles.checkDone]}>
                {checklistDone.scan && <Text style={styles.checkMark}>✓</Text>}
              </View>
              <Text style={styles.checkText}>Run your first scan</Text>
              {!checklistDone.scan && <Text style={styles.checkArrow}>→ Family</Text>}
            </TouchableOpacity>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, {
                width: (([checklistDone.child, checklistDone.scan].filter(Boolean).length + 1) / 3 * 100) + "%"
              }]} />
            </View>
          </View>
        )}

        {/* School */}
        <Text style={styles.section}>🏫 SCHOOL & ACTIVITIES</Text>
        {schoolEvents.length === 0
          ? <View style={styles.emptyCard}><Text style={styles.emptyText}>✓ Nothing scheduled today</Text></View>
          : schoolEvents.map(ev => <EventCard key={ev.id} ev={ev} />)}

        {/* Health */}
        <Text style={styles.section}>🏥 HEALTH & APPOINTMENTS</Text>
        {healthEvents.length === 0
          ? <View style={styles.emptyCard}><Text style={styles.emptyText}>✓ No appointments today</Text></View>
          : healthEvents.map(ev => <EventCard key={ev.id} ev={ev} />)}

        {/* Bills */}
        <Text style={styles.section}>💳 BILLS & PAYMENTS</Text>
        {billEvents.length === 0
          ? <View style={styles.emptyCard}><Text style={styles.emptyText}>✓ No bills due today</Text></View>
          : billEvents.map(ev => <EventCard key={ev.id} ev={ev} />)}

        {/* Ask Hearth */}
        <Text style={styles.section}>ASK HEARTH</Text>

        {isRecording && (
          <View style={styles.statusCard}>
            <Text style={styles.statusText}>🎙️ Recording... tap mic to stop</Text>
          </View>
        )}
        {isTranscribing && (
          <View style={styles.statusCard}>
            <ActivityIndicator size="small" color="#E8734A" />
            <Text style={styles.statusText}>  Transcribing...</Text>
          </View>
        )}
        {analyzing && (
          <View style={styles.statusCard}>
            <ActivityIndicator size="small" color="#E8734A" />
            <Text style={styles.statusText}>  Analyzing image with AI...</Text>
          </View>
        )}

        {chatReply ? (
          <View style={styles.replyCard}>
            <Text style={styles.replyText}>{chatReply}</Text>
            <TouchableOpacity onPress={() => setChatReply("")}>
              <Text style={styles.dismiss}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Input bar — GPT style */}
        <View style={styles.inputBar}>
          <TouchableOpacity style={styles.plusBtn}
            onPress={() => setShowPlusSheet(true)}>
            <Ionicons name="add" size={22} color="#666" />
          </TouchableOpacity>
          <TextInput
            style={styles.inputField}
            placeholder="Ask or speak a reminder..."
            placeholderTextColor="#A0856B"
            value={chatInput}
            onChangeText={setChatInput}
            onSubmitEditing={handleChat}
            returnKeyType="send"
            editable={!isRecording && !isTranscribing}
            multiline
          />
          <TouchableOpacity
            style={[styles.micBtn, isRecording && styles.micBtnActive]}
            onPress={handleMicPress}
            disabled={isTranscribing}>
            {isTranscribing
              ? <ActivityIndicator size="small" color="#E8734A" />
              : <Ionicons
                  name={isRecording ? "stop-circle" : "mic"}
                  size={20}
                  color={isRecording ? "#fff" : "#666"} />}
          </TouchableOpacity>
          {chatInput.trim() ? (
            <TouchableOpacity style={styles.sendBtn} onPress={handleChat}
              disabled={chatLoading}>
              {chatLoading
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="arrow-up" size={18} color="#fff" />}
            </TouchableOpacity>
          ) : null}
        </View>
        <Text style={styles.voiceHint}>
          Tap 🎙️ to speak a reminder or type and tap → to send
        </Text>

      </ScrollView>

      {/* Walkthrough modal */}
      <Modal visible={showWalkthrough} transparent animationType="fade">
        <View style={styles.walkthroughOverlay}>
          <View style={styles.walkthroughCard}>
            <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.walkthroughHandle} />
            <View style={styles.dotRow}>
              {[0,1,2,3].map(i => (
                <View key={i} style={[styles.dot, walkthroughStep === i && styles.dotActive]} />
              ))}
            </View>
            {walkthroughStep === 0 && <>
              <Text style={styles.wtEmoji}>🏠</Text>
              <Text style={styles.wtTitle}>Welcome to Hearth</Text>
              <Text style={styles.wtBody}>
                Your family's concierge — managing school events, bills, and appointments all in one place.
              </Text>
              <TouchableOpacity style={styles.wtPrimary}
                onPress={() => setWalkthroughStep(1)}>
                <Text style={[styles.wtPrimaryText, { color: "#fff" }]}>Get started →</Text>
              </TouchableOpacity>
            </>}
            {walkthroughStep === 1 && <>
              <Text style={styles.wtEmoji}>👧</Text>
              <Text style={styles.wtTitle}>Who are we looking after?</Text>
              <Text style={styles.wtBody}>Add your children so Hearth knows whose events to track in Gmail.</Text>
              <View style={styles.wtTips}>
                <Text style={styles.wtTip}>→  Family tab → Add a child</Text>
                <Text style={styles.wtTip}>→  Enter name and grade</Text>
              </View>
              <View style={styles.wtBtnRow}>
                <TouchableOpacity style={styles.wtGhost}
                  onPress={() => setWalkthroughStep(2)}>
                  <Text style={styles.wtGhostText}>Skip</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.wtPrimary}
                  onPress={() => setWalkthroughStep(2)}>
                  <Text style={[styles.wtPrimaryText, { color: "#fff" }]}>Next →</Text>
                </TouchableOpacity>
              </View>
            </>}
            {walkthroughStep === 2 && <>
              <Text style={styles.wtEmoji}>📧</Text>
              <Text style={styles.wtTitle}>Connect partner's Gmail</Text>
              <Text style={styles.wtBody}>Scan both inboxes. Partner approves once in browser — no app needed. Optional.</Text>
              <View style={styles.wtTips}>
                <Text style={styles.wtTip}>→  Family tab → Add family Gmail</Text>
                <Text style={styles.wtTip}>→  Share link — partner approves</Text>
              </View>
              <View style={styles.wtBtnRow}>
                <TouchableOpacity style={styles.wtGhost}
                  onPress={() => setWalkthroughStep(3)}>
                  <Text style={styles.wtGhostText}>Skip</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.wtPrimary}
                  onPress={() => setWalkthroughStep(3)}>
                  <Text style={[styles.wtPrimaryText, { color: "#fff" }]}>Next →</Text>
                </TouchableOpacity>
              </View>
            </>}
            {walkthroughStep === 3 && <>
              <Text style={styles.wtEmoji}>🔍</Text>
              <Text style={styles.wtTitle}>Run your first scan</Text>
              <Text style={styles.wtBody}>Hearth scans Gmail and Google Calendar for events, bills and appointments.</Text>
              <View style={styles.wtTips}>
                <Text style={styles.wtTip}>→  Family tab → Scan Gmail + Calendar</Text>
                <Text style={styles.wtTip}>→  Events appear in Upcoming tab</Text>
              </View>
              <View style={styles.wtBtnRow}>
                <TouchableOpacity style={styles.wtGhost} onPress={dismissWalkthrough}>
                  <Text style={styles.wtGhostText}>Skip</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.wtPrimary} onPress={() => {
                  dismissWalkthrough();
                  router.push("/(tabs)/profile");
                }}>
                  <Text style={[styles.wtPrimaryText, { color: "#fff" }]}>Go to Family →</Text>
                </TouchableOpacity>
              </View>
            </>}
          </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Plus sheet — GPT style bottom panel */}
      <Modal visible={showPlusSheet} transparent animationType="slide">
        <TouchableOpacity style={styles.sheetBackdrop}
          onPress={() => setShowPlusSheet(false)} activeOpacity={1}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Add to Hearth</Text>
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
              <TouchableOpacity style={styles.sheetItem} onPress={handleFiles}>
                <View style={styles.sheetIconBox}>
                  <Ionicons name="document-attach" size={28} color="#5C4033" />
                </View>
                <Text style={styles.sheetItemLabel}>Files</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Preview modal */}
      <Modal visible={showPreview} transparent animationType="slide">
        <View style={styles.previewOverlay}>
          <View style={styles.previewBox}>
            <Text style={styles.previewTitle}>Review extracted items</Text>
            <Text style={styles.previewSubtitle}>Tap to select/deselect</Text>
            <ScrollView style={{ maxHeight: 360 }}>
              {previewItems.map((item, i) => (
                <TouchableOpacity key={i}
                  style={[styles.previewItem, item.selected && styles.previewItemSelected]}
                  onPress={() => {
                    const u = [...previewItems];
                    u[i] = { ...u[i], selected: !u[i].selected };
                    setPreviewItems(u);
                  }}>
                  <Ionicons
                    name={item.selected ? "checkmark-circle" : "ellipse-outline"}
                    size={22} color={item.selected ? "#4A9E6B" : "#C0A090"} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.previewItemTitle}>{item.title}</Text>
                    {item.event_date
                      ? <Text style={styles.previewItemSub}>
                          {item.event_date}{item.event_time ? " at " + item.event_time : ""}
                        </Text>
                      : null}
                    {item.amount
                      ? <Text style={styles.previewItemSub}>
                          {item.amount}{item.due_date ? " — due " + item.due_date : ""}
                        </Text>
                      : null}
                    <Text style={styles.previewItemType}>
                      {item.type === "event" ? "📅 Calendar event" : "📋 Action item"}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={[styles.confirmBtn, { flex: 1 }]}
                onPress={() => confirmItems(previewItems)}>
                <Text style={styles.confirmBtnText}>
                  Add {previewItems.filter(i => i.selected).length} item(s)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.cancelBtn, { flex: 1 }]}
                onPress={() => setShowPreview(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  scroll:          { flex: 1, backgroundColor: "#FFF8F0" },
  content:         { padding: 20, paddingBottom: 40, paddingTop: 60 },
  center:          { flex: 1, alignItems: "center", justifyContent: "center" },
  header:          { flexDirection: "row", justifyContent: "space-between",
                     alignItems: "flex-start", marginBottom: 8 },
  greeting:        { fontSize: 26, fontWeight: "800", color: "#8B4513" },
  date:            { fontSize: 14, color: "#A0856B", marginTop: 2 },
  userTag:         { fontSize: 12, color: "#E8734A", marginTop: 4 },
  signOutBtn:      { padding: 8, backgroundColor: "#F5E6D3",
                     borderRadius: 20, marginTop: 4 },
  section:         { fontSize: 11, fontWeight: "700", color: "#A0856B",
                     letterSpacing: 1.5, marginTop: 20, marginBottom: 10 },
  emptyCard:       { backgroundColor: "#F0FFF4", borderRadius: 12,
                     padding: 12, alignItems: "center", marginBottom: 4 },
  emptyText:       { color: "#4A9E6B", fontWeight: "600", fontSize: 13 },
  eventCard:       { backgroundColor: "#fff", borderRadius: 14, padding: 14,
                     marginBottom: 8, elevation: 2 },
  eventChild:      { fontSize: 13, fontWeight: "700", color: "#E8734A" },
  eventLabel:      { fontSize: 15, fontWeight: "600", color: "#5C4033", marginTop: 2 },
  eventTime:       { fontSize: 12, color: "#E8734A", marginTop: 3, fontWeight: "600" },
  statusCard:      { flexDirection: "row", backgroundColor: "#FFF0E8", borderRadius: 12,
                     padding: 12, marginBottom: 8, alignItems: "center",
                     borderWidth: 1.5, borderColor: "#E8734A" },
  statusText:      { color: "#E8734A", fontWeight: "600", fontSize: 14 },
  replyCard:       { backgroundColor: "#F5E6D3", borderRadius: 12,
                     padding: 14, marginBottom: 12 },
  replyText:       { color: "#5C4033", fontSize: 14, lineHeight: 20 },
  dismiss:         { color: "#A0856B", fontSize: 12, marginTop: 8, alignSelf: "flex-end" },

  // GPT-style input bar
  inputBar:        { flexDirection: "row", alignItems: "flex-end",
                     backgroundColor: "#fff", borderRadius: 24,
                     borderWidth: 1, borderColor: "#E8E8E8",
                     paddingHorizontal: 8, paddingVertical: 6,
                     marginTop: 8, elevation: 2,
                     shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8 },
  plusBtn:         { padding: 8, marginBottom: 2 },
  inputField:      { flex: 1, fontSize: 15, color: "#333",
                     paddingHorizontal: 4, paddingVertical: 8,
                     maxHeight: 100 },
  micBtn:          { padding: 8, marginBottom: 2 },
  micBtnActive:    { backgroundColor: "#E8734A", borderRadius: 20 },
  sendBtn:         { backgroundColor: "#E8734A", borderRadius: 20,
                     width: 34, height: 34, alignItems: "center",
                     justifyContent: "center", marginBottom: 2 },

  // Plus sheet
  sheetBackdrop:   { flex: 1, backgroundColor: "rgba(0,0,0,0.4)",
                     justifyContent: "flex-end" },
  sheet:           { backgroundColor: "#fff", borderTopLeftRadius: 24,
                     borderTopRightRadius: 24, padding: 24, paddingBottom: 60, minHeight: 220 },
  sheetHandle:     { width: 40, height: 4, backgroundColor: "#E0E0E0",
                     borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  sheetTitle:      { fontSize: 16, fontWeight: "700", color: "#333",
                     marginBottom: 20 },
  sheetGrid:       { flexDirection: "row", gap: 16 },
  sheetItem:       { alignItems: "center", gap: 8 },
  sheetIconBox:    { width: 60, height: 60, borderRadius: 16,
                     backgroundColor: "#F5F5F5", alignItems: "center",
                     justifyContent: "center" },
  sheetItemLabel:  { fontSize: 13, color: "#333", fontWeight: "500" },

  // Preview modal
  previewOverlay:  { flex: 1, backgroundColor: "rgba(0,0,0,0.5)",
                     justifyContent: "flex-end" },
  previewBox:      { backgroundColor: "#FFF8F0", borderTopLeftRadius: 24,
                     borderTopRightRadius: 24, padding: 24, maxHeight: "85%" },
  previewTitle:    { fontSize: 20, fontWeight: "800", color: "#8B4513" },
  previewSubtitle: { fontSize: 13, color: "#A0856B", marginTop: 4, marginBottom: 16 },
  previewItem:     { flexDirection: "row", alignItems: "flex-start",
                     padding: 12, borderRadius: 12, marginBottom: 8,
                     backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#F5E6D3" },
  previewItemSelected: { borderColor: "#4A9E6B", backgroundColor: "#F0FFF4" },
  previewItemTitle:    { fontSize: 14, fontWeight: "700", color: "#5C4033" },
  previewItemSub:      { fontSize: 12, color: "#A0856B", marginTop: 2 },
  previewItemType:     { fontSize: 11, color: "#E8734A", marginTop: 4 },
  confirmBtn:      { backgroundColor: "#E8734A", borderRadius: 12,
                     paddingVertical: 14, alignItems: "center" },
  confirmBtnText:  { color: "#fff", fontWeight: "700", fontSize: 15 },
  cancelBtn:       { borderWidth: 1.5, borderColor: "#C0A090", borderRadius: 12,
                     paddingVertical: 14, alignItems: "center" },
  cancelBtnText:   { color: "#A0856B", fontWeight: "600", fontSize: 15 },
  deleteAction:    { backgroundColor: "#E84A4A", justifyContent: "center",
                   alignItems: "center", width: 80, borderRadius: 14,
                   marginBottom: 8, flexDirection: "column", gap: 4 },
  deleteText:      { color: "#fff", fontSize: 12, fontWeight: "600" },
  voiceHint:       { fontSize: 11, color: "#C0A090", marginTop: 6,
                     textAlign: "center", fontStyle: "italic", marginBottom: 8 },

  // Checklist
  checklistCard:  { backgroundColor: "#fff", borderRadius: 16, padding: 14,
                    marginBottom: 16, borderWidth: 1, borderColor: "#F5E6D3", elevation: 2 },
  checklistTitle: { fontSize: 14, fontWeight: "700", color: "#8B4513", marginBottom: 2 },
  checklistSub:   { fontSize: 12, color: "#A0856B", marginBottom: 10 },
  checkItem:      { flexDirection: "row", alignItems: "center", gap: 10,
                    paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: "#F5E6D3" },
  checkCircle:    { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5,
                    borderColor: "#E8734A", alignItems: "center", justifyContent: "center" },
  checkDone:      { backgroundColor: "#E8734A" },
  checkMark:      { color: "#fff", fontSize: 11, fontWeight: "700" },
  checkText:      { flex: 1, fontSize: 13, color: "#5C4033" },
  checkArrow:     { fontSize: 11, color: "#E8734A", fontWeight: "600" },
  progressBar:    { height: 4, backgroundColor: "#F5E6D3", borderRadius: 2, marginTop: 12 },
  progressFill:   { height: 4, backgroundColor: "#E8734A", borderRadius: 2 },

  // Walkthrough
  walkthroughOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)",
                        alignItems: "center", justifyContent: "center", padding: 24 },
  walkthroughCard:    { backgroundColor: "#F2F2F2", borderRadius: 24,
                        padding: 20, paddingBottom: 28, width: "100%",
                        maxHeight: "75%" },
  walkthroughHandle:  { width: 36, height: 4, backgroundColor: "#C0C0C0",
                        borderRadius: 2, alignSelf: "center", marginBottom: 14 },
  dotRow:        { flexDirection: "row", gap: 6, justifyContent: "center", marginBottom: 14 },
  dot:           { width: 6, height: 6, borderRadius: 3, backgroundColor: "#D0D0D0" },
  dotActive:     { width: 18, borderRadius: 3, backgroundColor: "#E8734A" },
  wtEmoji:       { fontSize: 36, textAlign: "center", marginBottom: 8 },
  wtTitle:       { fontSize: 18, fontWeight: "700", color: "#333",
                   textAlign: "center", marginBottom: 8 },
  wtBody:        { fontSize: 14, color: "#666", textAlign: "center",
                   lineHeight: 20, marginBottom: 14 },
  wtTips:        { backgroundColor: "#fff", borderRadius: 12, padding: 12, marginBottom: 14 },
  wtTip:         { fontSize: 13, color: "#5C4033", lineHeight: 22 },
  wtBtnRow:      { flexDirection: "row", gap: 10 },
  wtPrimary:     { flex: 1, backgroundColor: "#E8734A", borderRadius: 14,
                   paddingVertical: 12, alignItems: "center" },
  wtPrimaryText: { color: "#ffffff", fontWeight: "700", fontSize: 15 },
  wtGhost:       { flex: 1, borderWidth: 1, borderColor: "#D0D0D0", borderRadius: 14,
                   paddingVertical: 12, alignItems: "center" },
  wtGhostText:   { color: "#999", fontSize: 15 },
});
