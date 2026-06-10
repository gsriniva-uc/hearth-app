import { useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  TextInput, Modal, ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import { API_BASE_URL } from "@/constants/config";

export default function MedicalSetupModal({
  user_id, kids, visible, onClose, onComplete
}: {
  user_id: string;
  kids: any[];
  visible: boolean;
  onClose: () => void;
  onComplete: () => void;
}) {
  const [kidIndex, setKidIndex] = useState(0);
  const [input,    setInput]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [done,     setDone]     = useState(false);

  const kid = kids[kidIndex];

  async function handleSave() {
    if (input.trim()) {
      setLoading(true);
      try {
        await fetch(`${API_BASE_URL}/prescriptions`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id, child_name: kid.name, text: input.trim() }),
        });
      } catch {}
      finally { setLoading(false); }
    }
    setInput("");
    if (kidIndex < kids.length - 1) {
      setKidIndex(kidIndex + 1);
    } else {
      setDone(true);
    }
  }

  function handleClose() {
    setKidIndex(0); setInput(""); setDone(false);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <View style={s.overlay}>
        <View style={s.card}>
          <View style={s.handle} />

          {!done ? (
            <View>
              <Text style={s.title}>🏥 {kid?.name}</Text>
              <Text style={s.body}>
                Any regular prescriptions or medications for {kid?.name}? Hearth will track refill timing and flag if it's overdue.
              </Text>
              <TextInput style={s.input} multiline numberOfLines={3}
                placeholder="e.g. Zyrtec 10mg daily, EpiPen as needed, Vitamin D weekly"
                placeholderTextColor="#A0856B"
                value={input} onChangeText={setInput} />
              <TouchableOpacity style={[s.btn, loading && { opacity: 0.6 }]}
                disabled={loading} onPress={handleSave}>
                {loading ? <ActivityIndicator color="#fff" />
                  : <Text style={s.btnText}>{input.trim() ? "Save & continue →" : "Skip →"}</Text>}
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <Text style={s.title}>✅ All set!</Text>
              <Text style={s.body}>Hearth will monitor Gmail for prescription refills and flag when anything is overdue.</Text>
              <TouchableOpacity style={s.btn} onPress={() => { handleClose(); onComplete(); }}>
                <Text style={s.btnText}>Done</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity onPress={handleClose} style={s.skip}>
            <Text style={s.skipText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay:  { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  card:     { backgroundColor: "#FFF8F0", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  handle:   { width: 36, height: 4, backgroundColor: "#C0C0C0", borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  title:    { fontSize: 20, fontWeight: "800", color: "#8B4513", marginBottom: 8 },
  body:     { fontSize: 14, color: "#5C4033", lineHeight: 20, marginBottom: 16 },
  input:    { borderWidth: 1, borderColor: "#E8E8E8", borderRadius: 12, padding: 12, fontSize: 14, color: "#333", backgroundColor: "#fff", textAlignVertical: "top", marginBottom: 16, minHeight: 80 },
  btn:      { backgroundColor: "#E8734A", borderRadius: 14, paddingVertical: 14, alignItems: "center", marginBottom: 8 },
  btnText:  { color: "#fff", fontWeight: "700", fontSize: 15 },
  skip:     { alignItems: "center", paddingVertical: 8 },
  skipText: { color: "#A0856B", fontSize: 14 },
});
