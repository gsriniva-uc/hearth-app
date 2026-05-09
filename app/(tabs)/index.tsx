import { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, StyleSheet,
  RefreshControl, Alert, Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { useAuth } from "@/app/_layout";
import { API_BASE_URL } from "@/constants/config";

const SCHOOL_TYPES    = ["dress_down_day","early_dismissal","recital","field_trip",
                          "special_day","school_holiday","activity","sports_game","other"];
const HEALTH_TYPES    = ["doctor_appointment"];
const BILL_TYPES      = ["bill"];

export default function TodayScreen() {
  const { user, signOut } = useAuth();
  const USER_ID = user?.user_id || "";

  const [todayEvents,    setTodayEvents]    = useState<any[]>([]);
  const [chatInput,      setChatInput]      = useState("");
  const [chatReply,      setChatReply]      = useState("");
  const [loading,        setLoading]        = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);
  const [chatLoading,    setChatLoading]    = useState(false);
  const [isRecording,    setIsRecording]    = useState(false);
  const [showPlusMenu,   setShowPlusMenu]   = useState(false);
  const [analyzing,      setAnalyzing]      = useState(false);
  const [previewItems,   setPreviewItems]   = useState<any[]>([]);
  const [showPreview,    setShowPreview]    = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

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
          if (!silenceTimerRef.current) {
            silenceTimerRef.current = setTimeout(() => stopRecording(), 1500);
          }
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

  async function analyzeImage(base64: string, mimeType: string) {
    setAnalyzing(true);
    setShowPlusMenu(false);
    try {
      const res  = await fetch(`${API_BASE_URL}/analyze-image`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          user_id:   USER_ID,
          image:     base64,
          mime_type: mimeType,
        }),
      });
      const data = await res.json();
      if (data.items && data.items.length > 0) {
        setPreviewItems(data.items);
        setShowPreview(true);
      } else {
        Alert.alert("Nothing found", "Could not extract any actionable items from this image.");
      }
    } catch (e: any) {
      Alert.alert("Error", "Could not analyze image.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleCamera() {
    setShowPlusMenu(false);
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) {
      Alert.alert("Permission needed", "Please allow camera access.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality:    0.7,
      base64:     true,
    });
    if (!result.canceled && result.assets[0].base64) {
      await analyzeImage(result.assets[0].base64, "image/jpeg");
    }
  }

  async function handlePhotosFiles() {
    setShowPlusMenu(false);
    Alert.alert("Choose", "What would you like to pick?", [
      { text: "Photo from library", onPress: async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality:    0.7,
          base64:     true,
        });
        if (!result.canceled && result.assets[0].base64) {
          await analyzeImage(result.assets[0].base64, "image/jpeg");
        }
      }},
      { text: "PDF or document", onPress: async () => {
        const result = await DocumentPicker.getDocumentAsync({
          type: ["application/pdf", "image/*"],
          copyToCacheDirectory: true,
        });
        if (result.canceled) return;
        const file = result.assets[0];
        // Read as base64
        const { FileSystem } = require("expo-file-system/legacy");
        const b64 = await FileSystem.readAsStringAsync(file.uri, { encoding: "base64" });
        await analyzeImage(b64, file.mimeType || "application/pdf");
      }},
      { text: "Cancel", style: "cancel" },
    ]);
  }

  async function confirmItems(confirmed: any[]) {
    setShowPreview(false);
    let added = 0;
    for (const item of confirmed) {
      if (!item.selected) continue;
      try {
        if (item.type === "event") {
          await fetch(`${API_BASE_URL}/events`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({
              user_id:    USER_ID,
              child_name: item.child_name || "all",
              event_type: item.event_type || "other",
              event_date: item.event_date,
              event_time: item.event_time || null,
              notes:      item.notes || item.title,
            }),
          });
        } else if (item.type === "task") {
          await fetch(`${API_BASE_URL}/tasks`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({
              user_id:       USER_ID,
              task_type:     item.task_type || "bill",
              title:         item.title,
              due_date:      item.due_date || null,
              amount:        item.amount || null,
              payment_url:   item.payment_url || null,
              contact_name:  item.contact_name || null,
              draft_subject: item.draft_subject || null,
              draft_body:    item.draft_body || null,
              draft_to:      item.draft_to || null,
            }),
          });
        }
        added++;
      } catch (e) { console.error(e); }
    }
    loadData();
    Alert.alert("Done", added + " item(s) added successfully.");
  }

  async function handleMicPress() {
    if (isRecording) await stopRecording();
    else await startRecording();
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
      loadData();
      if ((data.response || "").includes("✅")) {
        setTimeout(() => setChatReply(""), 4000);
      }
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
      <Text style={styles.eventChild}>{ev.child_name !== "all" ? ev.child_name : ""}</Text>
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
    <>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing}
        onRefresh={() => { setRefreshing(true); loadData(); }} />}>

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

      {/* School Events */}
      <Text style={styles.section}>🏫 SCHOOL & ACTIVITIES</Text>
      {schoolEvents.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>✓ Nothing scheduled today</Text>
        </View>
      ) : schoolEvents.map(ev => <EventCard key={ev.id} ev={ev} />)}

      {/* Health */}
      <Text style={styles.section}>🏥 HEALTH & APPOINTMENTS</Text>
      {healthEvents.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>✓ No appointments today</Text>
        </View>
      ) : healthEvents.map(ev => <EventCard key={ev.id} ev={ev} />)}

      {/* Bills */}
      <Text style={styles.section}>💳 BILLS & PAYMENTS</Text>
      {billEvents.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>✓ No bills due today</Text>
        </View>
      ) : billEvents.map(ev => <EventCard key={ev.id} ev={ev} />)}

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
      {chatReply ? (
        <View style={styles.replyCard}>
          <Text style={styles.replyText}>{chatReply}</Text>
          <TouchableOpacity onPress={() => setChatReply("")}>
            <Text style={styles.dismiss}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      <View style={styles.chatRow}>
        <View style={styles.inputWrapper}>
          <TouchableOpacity style={styles.plusBtn}
            onPress={() => setShowPlusMenu(true)}>
            <Ionicons name="add-circle" size={24} color="#E8734A" />
          </TouchableOpacity>
          <TextInput style={styles.inputInner}
            placeholder="Ask or speak a reminder..."
            placeholderTextColor="#A0856B"
            value={chatInput} onChangeText={setChatInput}
            onSubmitEditing={handleChat} returnKeyType="send"
            editable={!isRecording && !isTranscribing} />
        </View>
        <TouchableOpacity
          style={[styles.micBtn, isRecording && styles.micBtnActive]}
          onPress={handleMicPress} disabled={isTranscribing}>
          {isTranscribing
            ? <ActivityIndicator size="small" color="#E8734A" />
            : <Ionicons name={isRecording ? "stop-circle" : "mic"} size={20}
                color={isRecording ? "#fff" : "#E8734A"} />}
        </TouchableOpacity>
        <TouchableOpacity style={styles.sendBtn} onPress={handleChat}
          disabled={chatLoading || !chatInput.trim()}>
          {chatLoading
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.sendText}>→</Text>}
        </TouchableOpacity>
      </View>
      <Text style={styles.voiceHint}>
        Tap 🎙️ → speak → auto-stops → tap → to send
      </Text>
    </ScrollView>

      {/* Analyzing overlay */}
      {analyzing && (
        <View style={styles.analyzingOverlay}>
          <ActivityIndicator size="large" color="#E8734A" />
          <Text style={styles.analyzingText}>Analyzing with AI...</Text>
        </View>
      )}

      {/* Plus menu — inline popup near + button */}
      {showPlusMenu && (
        <TouchableOpacity style={styles.menuBackdrop}
          onPress={() => setShowPlusMenu(false)}
          activeOpacity={1}>
          <View style={styles.menuBox}>
            <TouchableOpacity style={styles.menuItem} onPress={handleCamera}>
              <Ionicons name="camera" size={22} color="#E8734A" />
              <Text style={styles.menuItemText}>Camera</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity style={styles.menuItem} onPress={handlePhotosFiles}>
              <Ionicons name="image" size={22} color="#E8734A" />
              <Text style={styles.menuItemText}>Photos & Files</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      )}

      {/* Preview modal */}
      <Modal visible={showPreview} transparent animationType="slide">
        <View style={styles.previewOverlay}>
          <View style={styles.previewBox}>
            <Text style={styles.previewTitle}>Review extracted items</Text>
            <Text style={styles.previewSubtitle}>
              Select items to add to Hearth
            </Text>
            <ScrollView style={{ maxHeight: 360 }}>
              {previewItems.map((item, i) => (
                <TouchableOpacity key={i} style={[
                  styles.previewItem,
                  item.selected && styles.previewItemSelected
                ]} onPress={() => {
                  const updated = [...previewItems];
                  updated[i].selected = !updated[i].selected;
                  setPreviewItems(updated);
                }}>
                  <View style={styles.previewCheckbox}>
                    {item.selected
                      ? <Ionicons name="checkmark-circle" size={22} color="#4A9E6B" />
                      : <Ionicons name="ellipse-outline" size={22} color="#C0A090" />
                    }
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.previewItemTitle}>{item.title}</Text>
                    {item.event_date
                      ? <Text style={styles.previewItemSub}>{item.event_date}{item.event_time ? " at " + item.event_time : ""}</Text>
                      : null}
                    {item.amount
                      ? <Text style={styles.previewItemSub}>{item.amount}{item.due_date ? " — due " + item.due_date : ""}</Text>
                      : null}
                    <Text style={styles.previewItemType}>
                      {item.type === "event" ? "📅 Calendar event" : "📋 Action item"}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                style={[styles.confirmBtn, { flex: 1 }]}
                onPress={() => confirmItems(previewItems)}>
                <Text style={styles.confirmBtnText}>
                  Add {previewItems.filter(i => i.selected).length} item(s)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.cancelPreviewBtn, { flex: 1 }]}
                onPress={() => setShowPreview(false)}>
                <Text style={styles.cancelPreviewText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  scroll:        { flex:1, backgroundColor:"#FFF8F0" },
  content:       { padding:20, paddingBottom:40, paddingTop:60 },
  center:        { flex:1, alignItems:"center", justifyContent:"center" },
  header:        { flexDirection:"row", justifyContent:"space-between",
                   alignItems:"flex-start", marginBottom:8 },
  greeting:      { fontSize:26, fontWeight:"800", color:"#8B4513" },
  date:          { fontSize:14, color:"#A0856B", marginTop:2 },
  userTag:       { fontSize:12, color:"#E8734A", marginTop:4 },
  signOutBtn:    { padding:8, backgroundColor:"#F5E6D3", borderRadius:20, marginTop:4 },
  section:       { fontSize:11, fontWeight:"700", color:"#A0856B",
                   letterSpacing:1.5, marginTop:20, marginBottom:10 },
  emptyCard:     { backgroundColor:"#F0FFF4", borderRadius:12,
                   padding:12, alignItems:"center", marginBottom:4 },
  emptyText:     { color:"#4A9E6B", fontWeight:"600", fontSize:13 },
  eventCard:     { backgroundColor:"#fff", borderRadius:14, padding:14,
                   marginBottom:8, elevation:2 },
  eventChild:    { fontSize:13, fontWeight:"700", color:"#E8734A" },
  eventLabel:    { fontSize:15, fontWeight:"600", color:"#5C4033", marginTop:2 },
  eventTime:     { fontSize:12, color:"#E8734A", marginTop:3, fontWeight:"600" },
  statusCard:    { flexDirection:"row", backgroundColor:"#FFF0E8", borderRadius:12,
                   padding:12, marginBottom:8, alignItems:"center",
                   borderWidth:1.5, borderColor:"#E8734A" },
  statusText:    { color:"#E8734A", fontWeight:"600", fontSize:14 },
  replyCard:     { backgroundColor:"#F5E6D3", borderRadius:12,
                   padding:14, marginBottom:12 },
  replyText:     { color:"#5C4033", fontSize:14, lineHeight:20 },
  dismiss:       { color:"#A0856B", fontSize:12, marginTop:8, alignSelf:"flex-end" },
  chatRow:       { flexDirection:"row", gap:8, marginTop:8, alignItems:"center" },
  input:         { flex:1, backgroundColor:"#fff", borderRadius:12, padding:14,
                   fontSize:14, color:"#5C4033", borderWidth:1, borderColor:"#F5E6D3" },

  micBtn:        { backgroundColor:"#FFF0E8", borderRadius:12, padding:13,
                   justifyContent:"center", alignItems:"center",
                   borderWidth:1.5, borderColor:"#E8734A" },
  micBtnActive:  { backgroundColor:"#E8734A" },
  sendBtn:       { backgroundColor:"#E8734A", borderRadius:12, padding:14,
                   justifyContent:"center", alignItems:"center", width:48 },
  sendText:      { color:"#fff", fontSize:18, fontWeight:"700" },
  voiceHint:     { fontSize:11, color:"#C0A090", marginTop:8,
                   textAlign:"center", fontStyle:"italic" },
});
