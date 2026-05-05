import { useState } from "react";
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  StyleSheet, Linking, Alert, TextInput,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/app/_layout";
import { API_BASE_URL } from "@/constants/config";

export default function LoginScreen() {
  const { setUser }   = useAuth();
  const [loading,     setLoading]     = useState(false);
  const [code,        setCode]        = useState("");
  const [codeLoading, setCodeLoading] = useState(false);
  const [showCode,    setShowCode]    = useState(false);

  async function handleSignIn() {
    setLoading(true);
    try {
      await Linking.openURL(`${API_BASE_URL}/auth/login`);
    } catch {
      Alert.alert("Error", "Could not open sign-in page.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCodeSubmit() {
    if (code.length !== 6) {
      Alert.alert("Invalid code", "Please enter the 6-digit code.");
      return;
    }
    setCodeLoading(true);
    try {
      const res  = await fetch(`${API_BASE_URL}/auth/code?code=${code}`);
      const data = await res.json();
      if (data.error || !data.user) {
        Alert.alert("Invalid code", "Code not found or already used.");
        return;
      }
      await AsyncStorage.setItem("hearth_user", JSON.stringify(data.user));
      setUser(data.user);
    } catch {
      Alert.alert("Error", "Could not verify code.");
    } finally {
      setCodeLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🏠</Text>
      <Text style={styles.title}>Hearth</Text>
      <Text style={styles.tagline}>Your family's chief of staff</Text>

      <View style={styles.features}>
        {[
          "📅  School events from Gmail automatically",
          "🌅  Daily briefing every morning",
          "👨‍👩‍👧  Multiple Gmail accounts per family",
          "🎙️  Voice capture for quick reminders",
        ].map((f, i) => (
          <Text key={i} style={styles.feature}>{f}</Text>
        ))}
      </View>

      <TouchableOpacity style={styles.button} onPress={handleSignIn}
        disabled={loading}>
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.buttonText}>Sign in with Google</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setShowCode(!showCode)}
        style={styles.codeToggle}>
        <Text style={styles.codeToggleText}>
          {showCode ? "▲ Hide code entry" : "▼ Have a sign-in code?"}
        </Text>
      </TouchableOpacity>

      {showCode && (
        <View style={styles.codeBox}>
          <Text style={styles.codeLabel}>Enter 6-digit code from browser</Text>
          <TextInput
            style={styles.codeInput}
            value={code}
            onChangeText={setCode}
            keyboardType="numeric"
            maxLength={6}
            placeholder="000000"
            placeholderTextColor="#C0A090"
            textAlign="center" />
          <TouchableOpacity style={styles.codeButton}
            onPress={handleCodeSubmit} disabled={codeLoading}>
            {codeLoading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>Submit Code</Text>
            }
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.privacy}>
        Hearth only reads school-related emails. Your data stays private.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex:1, backgroundColor:"#FFF8F0", alignItems:"center",
                   justifyContent:"center", paddingHorizontal:32 },
  emoji:         { fontSize:64, marginBottom:8 },
  title:         { fontSize:40, fontWeight:"800", color:"#8B4513" },
  tagline:       { fontSize:16, color:"#A0856B", marginTop:4, marginBottom:36 },
  features:      { width:"100%", marginBottom:36, gap:12 },
  feature:       { fontSize:15, color:"#5C4033", lineHeight:22 },
  button:        { backgroundColor:"#E8734A", borderRadius:14, paddingVertical:16,
                   width:"100%", alignItems:"center", elevation:4 },
  buttonText:    { color:"#fff", fontSize:17, fontWeight:"700" },
  codeToggle:    { marginTop:16 },
  codeToggleText:{ color:"#A0856B", fontSize:13 },
  codeBox:       { width:"100%", marginTop:12, backgroundColor:"#fff",
                   borderRadius:14, padding:20, gap:12, elevation:2 },
  codeLabel:     { fontSize:14, color:"#8B4513", fontWeight:"600",
                   textAlign:"center" },
  codeInput:     { borderWidth:2, borderColor:"#E8734A", borderRadius:12,
                   padding:14, fontSize:32, fontWeight:"800",
                   color:"#8B4513", letterSpacing:8 },
  codeButton:    { backgroundColor:"#E8734A", borderRadius:12,
                   paddingVertical:14, alignItems:"center" },
  privacy:       { marginTop:20, fontSize:12, color:"#A0856B",
                   textAlign:"center", lineHeight:18 },
});
