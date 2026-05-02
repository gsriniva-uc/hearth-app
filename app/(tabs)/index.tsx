import { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, StyleSheet,
  RefreshControl, Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import { useAuth } from "@/app/_layout";
import { API_BASE_URL } from "@/constants/config";

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
      if (!granted) {
        Alert.alert("Permission needed", "Please allow microphone access.");
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setIsRecording(true);

      // Silence detection
      recording.setOnRecordingStatusUpdate((status) => {
        if (!status.isRecording) return;
        const volume = status.metering ?? -160;
        if (volume < -40) {
          if (!silenceTimerRef.current) {
            silenceTimerRef.current = setTimeout(() => stopRecording(), 1500);
          }
        } else {
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
        }
      });
      recording.setProgressUpdateInterval(100);
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Could not start recording.");
    }
  }

  async function stopRecording() {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (!recordingRef.current) return;
    setIsRecording(false);
    setIsTranscribing(true);
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      if (uri) await transcribeAudio(uri);
    } catch (e) {
      console.error(e);
    } finally {
      setIsTranscribing(false);
    }
  }

  async function transcribeAudio(uri: string) {
    try {
      const tokenRes  = await fetch(`${API_BASE_URL}/auth/speech-token?user_id=${USER_ID}`);
      const tokenData = await tokenRes.json();
      if (!tokenData.token) {
        Alert.alert("Error", "Could not get speech token. Please sign in again.");
        return;
      }
      const base64Audio = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const speechRes = await fetch(
        "https://speech.googleapis.com/v1/speech:recognize",
        {
          method:  "POST",
          headers: {
            "Content-Type":  "application/json",
            "Authorization": "Bearer " + tokenData.token,
          },
          body: JSON.stringify({
            config: {
              encoding:                   "LINEAR16",
              sampleRateHertz:            44100,
              languageCode:               "en-US",
              model:                      "default",
              enableAutomaticPunctuation: true,
            },
            audio: { content: base64Audio },
          }),
        }
      );
      const speechData = await speechRes.json();
      const transcript = speechData.results?.[0]?.alternatives?.[0]?.transcript || "";
      if (transcript) {
        setChatInput(transcript);
      } else {
        Alert.alert("Could not hear you", "Please try speaking again.");
      }
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Transcription failed. Please type instead.");
    }
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
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ user_id: USER_ID, raw_text: chatInput.trim() }),
      });
      const data = await res.json();
      setChatReply(data.response || "");
      setChatInput("");
    } catch { Alert.alert("Error", "Could not reach Hearth."); }
    finally { setChatLoading(false); }
  }

  function handleSignOut() {
    Alert.alert("Sign out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: signOut },
    ]);
  }

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric" });

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#E8734A" />
    </View>
  );

  return (
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

      <Text style={styles.section}>TODAY</Text>
      {todayEvents.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>✓ Nothing scheduled today</Text>
        </View>
      ) : todayEvents.map((ev: any) => (
        <View key={ev.id} style={styles.eventCard}>
          <Text style={styles.eventChild}>{ev.child_name}</Text>
          <Text style={styles.eventLabel}>
            {ev.event_type.replace(/_/g, " ")
              .replace(/\b\w/g, (c: string) => c.toUpperCase())}
          </Text>
          {ev.notes ? <Text style={styles.eventNotes}>{ev.notes}</Text> : null}
        </View>
      ))}

      <Text style={styles.section}>ASK HEARTH</Text>
      {isRecording && (
        <View style={styles.statusCard}>
          <Text style={styles.statusText}>🎙️ Recording... tap mic to stop</Text>
          <Text style={styles.statusHint}>Auto-stops when you finish speaking</Text>
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
        <TextInput style={styles.input}
          placeholder="Ask or speak a reminder..."
          placeholderTextColor="#A0856B"
          value={chatInput} onChangeText={setChatInput}
          onSubmitEditing={handleChat} returnKeyType="send"
          editable={!isRecording && !isTranscribing} />
        <TouchableOpacity
          style={[styles.micBtn, isRecording && styles.micBtnActive]}
          onPress={handleMicPress} disabled={isTranscribing}>
          {isTranscribing
            ? <ActivityIndicator size="small" color="#E8734A" />
            : <Ionicons
                name={isRecording ? "stop-circle" : "mic"}
                size={20}
                color={isRecording ? "#fff" : "#E8734A"} />
          }
        </TouchableOpacity>
        <TouchableOpacity style={styles.sendBtn} onPress={handleChat}
          disabled={chatLoading || !chatInput.trim()}>
          {chatLoading
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.sendText}>→</Text>}
        </TouchableOpacity>
      </View>
      <Text style={styles.voiceHint}>
        Tap 🎙️ → speak → auto-stops when done → tap → to send
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll:       { flex: 1, backgroundColor: "#FFF8F0" },
  content:      { padding: 20, paddingBottom: 40, paddingTop: 60 },
  center:       { flex: 1, alignItems: "center", justifyContent: "center" },
  header:       { flexDirection: "row", justifyContent: "space-between",
                  alignItems: "flex-start", marginBottom: 8 },
  greeting:     { fontSize: 26, fontWeight: "800", color: "#8B4513" },
  date:         { fontSize: 14, color: "#A0856B", marginTop: 2 },
  userTag:      { fontSize: 12, color: "#E8734A", marginTop: 4 },
  signOutBtn:   { padding: 8, backgroundColor: "#F5E6D3",
                  borderRadius: 20, marginTop: 4 },
  section:      { fontSize: 11, fontWeight: "700", color: "#A0856B",
                  letterSpacing: 1.5, marginTop: 16, marginBottom: 10 },
  emptyCard:    { backgroundColor: "#F0FFF4", borderRadius: 12,
                  padding: 16, alignItems: "center" },
  emptyText:    { color: "#4A9E6B", fontWeight: "600" },
  eventCard:    { backgroundColor: "#fff", borderRadius: 14, padding: 14,
                  marginBottom: 8, elevation: 2 },
  eventChild:   { fontSize: 13, fontWeight: "700", color: "#E8734A" },
  eventLabel:   { fontSize: 15, fontWeight: "600", color: "#5C4033", marginTop: 2 },
  eventNotes:   { fontSize: 12, color: "#A0856B", marginTop: 4 },
  statusCard:   { flexDirection: "row", backgroundColor: "#FFF0E8",
                  borderRadius: 12, padding: 12, marginBottom: 8,
                  alignItems: "center", borderWidth: 1.5, borderColor: "#E8734A" },
  statusText:   { color: "#E8734A", fontWeight: "600", fontSize: 14 },
  statusHint:   { color: "#A0856B", fontSize: 11, marginTop: 2 },
  replyCard:    { backgroundColor: "#F5E6D3", borderRadius: 12,
                  padding: 14, marginBottom: 12 },
  replyText:    { color: "#5C4033", fontSize: 14, lineHeight: 20 },
  dismiss:      { color: "#A0856B", fontSize: 12, marginTop: 8, alignSelf: "flex-end" },
  chatRow:      { flexDirection: "row", gap: 8, marginTop: 8, alignItems: "center" },
  input:        { flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 14,
                  fontSize: 14, color: "#5C4033", borderWidth: 1,
                  borderColor: "#F5E6D3" },
  micBtn:       { backgroundColor: "#FFF0E8", borderRadius: 12, padding: 13,
                  justifyContent: "center", alignItems: "center",
                  borderWidth: 1.5, borderColor: "#E8734A" },
  micBtnActive: { backgroundColor: "#E8734A" },
  sendBtn:      { backgroundColor: "#E8734A", borderRadius: 12, padding: 14,
                  justifyContent: "center", alignItems: "center", width: 48 },
  sendText:     { color: "#fff", fontSize: 18, fontWeight: "700" },
  voiceHint:    { fontSize: 11, color: "#C0A090", marginTop: 8,
                  textAlign: "center", fontStyle: "italic" },
});
