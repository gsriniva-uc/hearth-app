/**
 * components/VoiceCapture.tsx — Voice input → task creation
 *
 * User taps mic → speaks → Hearth transcribes → creates task/reminder
 *
 * Uses expo-av for recording and sends audio transcript to backend.
 * Beginner note: Modal = overlay on top of current screen.
 */
import { useState } from "react";
import {
  View, Text, TouchableOpacity, Modal,
  ActivityIndicator, StyleSheet, Alert,
} from "react-native";
import { Audio } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { createTaskFromVoice } from "@/lib/api";

interface Props {
  userId:        string;
  onClose:       () => void;
  onTaskCreated: () => void;
}

export default function VoiceCapture({ userId, onClose, onTaskCreated }: Props) {
  const [recording,  setRecording]  = useState<Audio.Recording | null>(null);
  const [isRecording,setIsRecording]= useState(false);
  const [transcript, setTranscript] = useState("");
  const [processing, setProcessing] = useState(false);

  async function startRecording() {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert("Permission needed", "Please allow microphone access.");
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setIsRecording(true);
    } catch (e) {
      Alert.alert("Error", "Could not start recording.");
    }
  }

  async function stopRecording() {
    if (!recording) return;
    setIsRecording(false);
    setProcessing(true);
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      // For MVP: send the transcript text manually
      // Full implementation: send audio URI to Whisper API → get transcript
      // Here we simulate with a prompt for manual entry
      setRecording(null);
      setTranscript("Tap 'Use text instead' to type your reminder");
    } catch {
      Alert.alert("Error", "Recording failed.");
    } finally {
      setProcessing(false);
    }
  }

  async function createFromText(text: string) {
    if (!text.trim()) return;
    setProcessing(true);
    try {
      await createTaskFromVoice(userId, text);
      onTaskCreated();
      onClose();
    } catch {
      Alert.alert("Error", "Could not create task.");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>🎙️ Voice Capture</Text>
          <Text style={styles.subtitle}>
            Speak your reminder — "Remind me to call the pharmacy at 4pm"
          </Text>

          {/* Record button */}
          <TouchableOpacity
            style={[styles.micBtn, isRecording && styles.micBtnActive]}
            onPress={isRecording ? stopRecording : startRecording}
            disabled={processing}
          >
            {processing ? (
              <ActivityIndicator size="large" color="#fff" />
            ) : (
              <Ionicons
                name={isRecording ? "stop" : "mic"}
                size={40} color="#fff"
              />
            )}
          </TouchableOpacity>
          <Text style={styles.micLabel}>
            {isRecording ? "Tap to stop" : "Tap to speak"}
          </Text>

          {/* Manual text fallback */}
          <TouchableOpacity
            style={styles.textFallback}
            onPress={() => {
              Alert.prompt(
                "Type your reminder",
                "e.g. Remind me to call the pharmacy at 4pm",
                (text) => text && createFromText(text),
                "plain-text"
              );
            }}
          >
            <Text style={styles.textFallbackLabel}>
              Use text instead →
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:           { flex:1, backgroundColor:"rgba(0,0,0,0.5)",
                       justifyContent:"flex-end" },
  sheet:             { backgroundColor:"#FFF8F0", borderTopLeftRadius:24,
                       borderTopRightRadius:24, padding:32,
                       alignItems:"center", paddingBottom:48 },
  title:             { fontSize:22, fontWeight:"800", color:"#8B4513" },
  subtitle:          { fontSize:14, color:"#A0856B", textAlign:"center",
                       marginTop:8, marginBottom:32, lineHeight:20 },
  micBtn:            { width:100, height:100, borderRadius:50,
                       backgroundColor:"#E8734A", alignItems:"center",
                       justifyContent:"center", shadowColor:"#E8734A",
                       shadowOffset:{width:0,height:4}, shadowOpacity:0.4,
                       shadowRadius:12 },
  micBtnActive:      { backgroundColor:"#E84A4A", transform:[{scale:1.1}] },
  micLabel:          { marginTop:16, fontSize:14, color:"#A0856B" },
  textFallback:      { marginTop:24, padding:14 },
  textFallbackLabel: { color:"#E8734A", fontWeight:"600", fontSize:15 },
  closeBtn:          { marginTop:16 },
  closeBtnText:      { color:"#A0856B", fontSize:15 },
});
