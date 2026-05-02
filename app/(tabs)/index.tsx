import { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, StyleSheet,
  RefreshControl, Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/app/_layout";
import { API_BASE_URL } from "@/constants/config";

let Voice: any = null;
try { Voice = require("@react-native-voice/voice").default; } catch {}

export default function TodayScreen() {
  const { user, signOut } = useAuth();
  const USER_ID = user?.user_id || "";

  const [todayEvents, setTodayEvents] = useState<any[]>([]);
  const [chatInput,   setChatInput]   = useState("");
  const [chatReply,   setChatReply]   = useState("");
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const loadData = useCallback(async () => {
    if (!USER_ID) { setLoading(false); return; }
    try {
      const res  = await fetch(`${API_BASE_URL}/events/today?user_id=${USER_ID}`);
      const data = await res.json();
      setTodayEvents(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [USER_ID]);

  useEffect(() => {
    loadData();
    if (Voice) {
      Voice.onSpeechResults = (e: any) => {
        const text = e.value?.[0] || "";
        if (text) setChatInput(text);
        setIsListening(false);
      };
      Voice.onSpeechError = () => setIsListening(false);
      Voice.onSpeechEnd   = () => setIsListening(false);
    }
    return () => { if (Voice) Voice.destroy().then(Voice.removeAllListeners); };
  }, [loadData]);

  async function toggleVoice() {
    if (!Voice) { Alert.alert("Voice not available", "Please type instead."); return; }
    if (isListening) {
      await Voice.stop(); setIsListening(false);
    } else {
      try { setChatInput(""); setIsListening(true); await Voice.start("en-US"); }
      catch { setIsListening(false); Alert.alert("Error", "Could not start voice."); }
    }
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
    weekday:"long", month:"long", day:"numeric" });

  if (loading) return (
    <View style={styles.center}><ActivityIndicator size="large" color="#E8734A" /></View>
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
            {ev.event_type.replace(/_/g," ").replace(/\b\w/g,(c:string)=>c.toUpperCase())}
          </Text>
          {ev.notes ? <Text style={styles.eventNotes}>{ev.notes}</Text> : null}
        </View>
      ))}

      <Text style={styles.section}>ASK HEARTH</Text>
      {isListening && (
        <View style={styles.listeningCard}>
          <Text style={styles.listeningText}>🎙️ Listening... speak now</Text>
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
          placeholder={isListening ? "Listening..." : "Ask or speak a reminder..."}
          placeholderTextColor={isListening ? "#E8734A" : "#A0856B"}
          value={chatInput} onChangeText={setChatInput}
          onSubmitEditing={handleChat} returnKeyType="send"
          editable={!isListening} />
        <TouchableOpacity
          style={[styles.micBtn, isListening && styles.micBtnActive]}
          onPress={toggleVoice}>
          <Ionicons name={isListening ? "stop-circle" : "mic"} size={20}
            color={isListening ? "#fff" : "#E8734A"} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.sendBtn} onPress={handleChat}
          disabled={chatLoading || !chatInput.trim()}>
          {chatLoading
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.sendText}>→</Text>}
        </TouchableOpacity>
      </View>
      <Text style={styles.voiceHint}>
        Tap 🎙️ and say "Remind me to sign Emma's form tomorrow"
      </Text>
    </ScrollView>
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
                   letterSpacing:1.5, marginTop:16, marginBottom:10 },
  emptyCard:     { backgroundColor:"#F0FFF4", borderRadius:12,
                   padding:16, alignItems:"center" },
  emptyText:     { color:"#4A9E6B", fontWeight:"600" },
  eventCard:     { backgroundColor:"#fff", borderRadius:14, padding:14,
                   marginBottom:8, elevation:2 },
  eventChild:    { fontSize:13, fontWeight:"700", color:"#E8734A" },
  eventLabel:    { fontSize:15, fontWeight:"600", color:"#5C4033", marginTop:2 },
  eventNotes:    { fontSize:12, color:"#A0856B", marginTop:4 },
  listeningCard: { backgroundColor:"#FFF0E8", borderRadius:12, padding:12,
                   marginBottom:8, alignItems:"center", borderWidth:1.5,
                   borderColor:"#E8734A" },
  listeningText: { color:"#E8734A", fontWeight:"600", fontSize:14 },
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
