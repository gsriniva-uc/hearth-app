import { useState } from "react";
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  StyleSheet, Linking, Alert,
} from "react-native";
import { API_BASE_URL } from "@/constants/config";

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);

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
      <TouchableOpacity style={styles.button} onPress={handleSignIn} disabled={loading}>
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.buttonText}>Sign in with Google</Text>
        }
      </TouchableOpacity>
      <Text style={styles.privacy}>
        Hearth only reads school-related emails. Your data stays private.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex:1, backgroundColor:"#FFF8F0", alignItems:"center",
                justifyContent:"center", paddingHorizontal:32 },
  emoji:      { fontSize:64, marginBottom:8 },
  title:      { fontSize:40, fontWeight:"800", color:"#8B4513" },
  tagline:    { fontSize:16, color:"#A0856B", marginTop:4, marginBottom:36 },
  features:   { width:"100%", marginBottom:36, gap:12 },
  feature:    { fontSize:15, color:"#5C4033", lineHeight:22 },
  button:     { backgroundColor:"#E8734A", borderRadius:14, paddingVertical:16,
                width:"100%", alignItems:"center",
                shadowColor:"#E8734A", shadowOffset:{width:0,height:4},
                shadowOpacity:0.3, shadowRadius:8, elevation:6 },
  buttonText: { color:"#fff", fontSize:17, fontWeight:"700" },
  privacy:    { marginTop:20, fontSize:12, color:"#A0856B", textAlign:"center", lineHeight:18 },
});
