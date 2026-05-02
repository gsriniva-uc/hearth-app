import { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, Linking, Share,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { globalUser, setGlobalUser } from "@/app/_layout";
import { API_BASE_URL } from "@/constants/config";

const APK_URL = "https://expo.dev/accounts/gsriniva/projects/hearth-app-gs-aliq2kjh1s8wphd0xuvka/builds/392c23ab-ac12-4042-b184-8842bf7a9e02";

export default function ProfileScreen() {
  const router = useRouter();
  const user   = globalUser;
  const [children,  setChildren]  = useState<any[]>([]);
  const [gmails,    setGmails]    = useState<string[]>([]);
  const [scanning,  setScanning]  = useState(false);

  useEffect(() => {
    if (!user) return;
    fetch(`${API_BASE_URL}/profiles?user_id=${user.user_id}`)
      .then(r => r.json()).then(setChildren).catch(console.error);
    fetch(`${API_BASE_URL}/connected-gmails?user_id=${user.user_id}`)
      .then(r => r.json()).then(d => setGmails(d.emails || [user.email]))
      .catch(() => setGmails([user?.email || ""]));
  }, [user]);

  async function handleSignOut() {
    Alert.alert("Sign out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: async () => {
        await AsyncStorage.multiRemove(["hearth_user", "google_token"]);
        setGlobalUser(null);
        router.replace("/(auth)/login");
      }},
    ]);
  }

  async function handleAddGmail() {
    Alert.alert("Add family Gmail", "How would you like to connect?", [
      { text: "Cancel", style: "cancel" },
      { text: "Connect from this phone", onPress: () =>
          Linking.openURL(`${API_BASE_URL}/auth/login?user_id=${user?.user_id}&add_account=true`) },
      { text: "Send link to family member", onPress: async () =>
          Share.share({
            message: `Connect your Gmail to our Hearth family calendar:\n${API_BASE_URL}/auth/login?user_id=${user?.user_id}&add_account=true`,
          }) },
    ]);
  }

  async function handleScanAll() {
    if (!user) return;
    setScanning(true);
    try {
      const res    = await fetch(`${API_BASE_URL}/gmail/scan-all?user_id=${user.user_id}`,
                                { method: "POST" });
      const result = await res.json();
      Alert.alert("Done", `Found ${result.new} new event(s) across ${result.accounts_scanned} account(s).`);
    } catch {
      Alert.alert("Error", "Scan failed.");
    } finally {
      setScanning(false);
    }
  }

  async function handleInvite() {
    Share.share({
      message: `I'm using Hearth to manage our family calendar — school events automated from Gmail!\n\nDownload: ${APK_URL}`,
    });
  }

  if (!user) return null;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.userCard}>
        <View style={styles.avatarFallback}>
          <Text style={styles.avatarText}>{user.name[0]}</Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{user.name}</Text>
          <Text style={styles.userEmail}>{user.email}</Text>
        </View>
      </View>

      <Text style={styles.section}>CONNECTED GMAIL ACCOUNTS</Text>
      {gmails.map((email, i) => (
        <View key={i} style={styles.gmailRow}>
          <Ionicons name="mail" size={18} color="#4A9E6B" />
          <Text style={styles.gmailText}>{email}</Text>
          <Text style={styles.badge}>✓</Text>
        </View>
      ))}
      <TouchableOpacity style={styles.addBtn} onPress={handleAddGmail}>
        <Ionicons name="add-circle-outline" size={20} color="#E8734A" />
        <Text style={styles.addText}>Add family Gmail account</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.scanBtn} onPress={handleScanAll} disabled={scanning}>
        <Ionicons name="refresh" size={18} color="#fff" />
        <Text style={styles.scanText}>{scanning ? "Scanning..." : "Scan all Gmail accounts"}</Text>
      </TouchableOpacity>

      <Text style={styles.section}>CHILDREN</Text>
      {children.length === 0
        ? <Text style={styles.empty}>No profiles yet</Text>
        : children.map((c: any) => (
          <View key={c.id} style={styles.childCard}>
            <Text style={styles.childName}>{c.name}</Text>
            <Text style={styles.childDetail}>
              {[c.grade && "Grade " + c.grade, c.school].filter(Boolean).join(" · ")}
            </Text>
          </View>
        ))
      }

      <Text style={styles.section}>SHARE HEARTH</Text>
      <TouchableOpacity style={styles.shareBtn} onPress={handleInvite}>
        <Ionicons name="share-social" size={20} color="#fff" />
        <Text style={styles.shareText}>Invite a friend to Hearth</Text>
      </TouchableOpacity>
      <Text style={styles.shareNote}>
        Friends sign in with their own Google account and get their own private family calendar.
      </Text>

      <Text style={styles.section}>ACCOUNT</Text>
      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Ionicons name="log-out-outline" size={20} color="#E84A4A" />
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll:         { flex:1, backgroundColor:"#FFF8F0" },
  content:        { padding:20, paddingTop:60, paddingBottom:60 },
  userCard:       { flexDirection:"row", alignItems:"center", backgroundColor:"#fff",
                    borderRadius:16, padding:16, marginBottom:24, elevation:2 },
  avatarFallback: { width:56, height:56, borderRadius:28, backgroundColor:"#E8734A",
                    alignItems:"center", justifyContent:"center" },
  avatarText:     { color:"#fff", fontSize:24, fontWeight:"700" },
  userInfo:       { marginLeft:14, flex:1 },
  userName:       { fontSize:18, fontWeight:"700", color:"#8B4513" },
  userEmail:      { fontSize:13, color:"#A0856B", marginTop:2 },
  section:        { fontSize:11, fontWeight:"700", color:"#A0856B",
                    letterSpacing:1.5, marginBottom:10, marginTop:24 },
  gmailRow:       { flexDirection:"row", alignItems:"center", backgroundColor:"#fff",
                    borderRadius:12, padding:14, marginBottom:8, gap:10, elevation:1 },
  gmailText:      { flex:1, fontSize:14, color:"#5C4033" },
  badge:          { fontSize:14, color:"#4A9E6B", fontWeight:"700" },
  addBtn:         { flexDirection:"row", alignItems:"center", gap:8, padding:14,
                    borderRadius:12, borderWidth:1.5, borderColor:"#E8734A",
                    borderStyle:"dashed", justifyContent:"center", marginTop:4 },
  addText:        { color:"#E8734A", fontWeight:"600", fontSize:14 },
  scanBtn:        { flexDirection:"row", alignItems:"center", gap:8,
                    backgroundColor:"#4A7BE8", borderRadius:12,
                    padding:14, justifyContent:"center", marginTop:10 },
  scanText:       { color:"#fff", fontWeight:"600", fontSize:14 },
  childCard:      { backgroundColor:"#fff", borderRadius:12, padding:14,
                    marginBottom:8, elevation:1 },
  childName:      { fontSize:16, fontWeight:"700", color:"#8B4513" },
  childDetail:    { fontSize:13, color:"#A0856B", marginTop:2 },
  empty:          { color:"#A0856B", fontSize:14, fontStyle:"italic" },
  shareBtn:       { flexDirection:"row", alignItems:"center", gap:10,
                    backgroundColor:"#E8734A", borderRadius:12,
                    padding:16, justifyContent:"center" },
  shareText:      { color:"#fff", fontWeight:"700", fontSize:15 },
  shareNote:      { fontSize:12, color:"#A0856B", marginTop:10,
                    lineHeight:18, textAlign:"center" },
  signOutBtn:     { flexDirection:"row", alignItems:"center", gap:10,
                    backgroundColor:"#FFF0F0", borderRadius:12, padding:16 },
  signOutText:    { color:"#E84A4A", fontWeight:"600", fontSize:15 },
});
