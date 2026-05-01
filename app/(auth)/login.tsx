/**
 * app/(auth)/login.tsx — Sign in screen
 *
 * Simple, warm login screen.
 * One button: Sign in with Google.
 * After sign-in, navigates to the main app.
 *
 * Beginner note: useRouter() lets you navigate between screens.
 */
import { useState } from "react";
import {
  View, Text, TouchableOpacity, Image,
  ActivityIndicator, Alert, StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { signInWithGoogle } from "@/lib/auth";
import { setGlobalUser } from "@/app/_layout";

export default function LoginScreen() {
  const router  = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    setLoading(true);
    try {
      const user = await signInWithGoogle();
      if (user) {
        setGlobalUser(user);
        router.replace("/(tabs)");
      } else {
        Alert.alert("Sign in cancelled", "Please try again.");
      }
    } catch (err: any) {
      Alert.alert("Sign in failed", err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      {/* Logo + name */}
      <View style={styles.hero}>
        <Text style={styles.emoji}>🏠</Text>
        <Text style={styles.appName}>Hearth</Text>
        <Text style={styles.tagline}>Your family's chief of staff</Text>
      </View>

      {/* Feature bullets */}
      <View style={styles.features}>
        {[
          "📅  School events extracted from Gmail automatically",
          "📋  Action items with one-tap email drafts",
          "🌅  Daily briefing every morning at 7am",
          "🎙️  Voice capture — speak to create reminders",
        ].map((f, i) => (
          <Text key={i} style={styles.feature}>{f}</Text>
        ))}
      </View>

      {/* Sign in button */}
      <TouchableOpacity
        style={styles.button}
        onPress={handleSignIn}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Sign in with Google</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.privacy}>
        Your data stays private. Hearth only reads school-related emails.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex:1, backgroundColor:"#FFF8F0", alignItems:"center",
                justifyContent:"center", paddingHorizontal:32 },
  hero:       { alignItems:"center", marginBottom:40 },
  emoji:      { fontSize:64, marginBottom:12 },
  appName:    { fontSize:40, fontWeight:"800", color:"#8B4513" },
  tagline:    { fontSize:16, color:"#A0856B", marginTop:4 },
  features:   { width:"100%", marginBottom:40, gap:12 },
  feature:    { fontSize:15, color:"#5C4033", lineHeight:22 },
  button:     { backgroundColor:"#E8734A", borderRadius:14, paddingVertical:16,
                paddingHorizontal:32, width:"100%", alignItems:"center",
                shadowColor:"#E8734A", shadowOffset:{width:0,height:4},
                shadowOpacity:0.3, shadowRadius:8, elevation:6 },
  buttonText: { color:"#fff", fontSize:17, fontWeight:"700" },
  privacy:    { marginTop:20, fontSize:12, color:"#A0856B", textAlign:"center" },
});
