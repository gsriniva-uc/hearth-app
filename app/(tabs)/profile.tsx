import { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, Linking, Share,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/app/_layout";
import { API_BASE_URL } from "@/constants/config";

const APK_URL = "https://expo.dev/accounts/gsriniva/projects/hearth-app-gs-aliq2kjh1s8wphd0xuvka/builds/f3a07f1d-446d-419e-a5c7-3f7535d552eb";

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [children, setChildren] = useState<any[]>([]);
  const [gmails,   setGmails]   = useState<string[]>([]);
  const [scanning, setScanning] = useState(false);

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
      { text: "Sign out", style: "destructive", onPress: signOut },
    ]);
  }

  async function handleAddGmail() {
    Alert.alert("Add family Gmail", "How would you like to connect?", [
      { text: "Cancel", style: "cancel" },
      { text: "From this phone", onPress: () =>
          Linking.openURL(`${API_BASE_URL}/auth/login?user_id=${user?.user_id}&add_account=true`) },
      { text: "Send link to family", onPress: () =>
          Share.share({ message:
            `Connect your Gmail to our Hearth family calendar:\n${API_BASE_URL}/auth/login?user_id=${user?.user_id}&add_account=true` }) },
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

  if (!user) {
    return (
      <View style={{ flex:1, alignItems:"center", justifyContent:"center", backgroundColor:"#FFF8F0" }}>
        <Text style={{ color:"#A0856B" }}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.userCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user.name[0]}</Text>
        </View>
        <View style={{ marginLeft:14, flex:1 }}>
          <Text style={styles.userName}>{user.name}</Text>
          <Text style={styles.userEmail}>{user.email}</Text>
        </View>
      </View>

      <Text style={styles.section}>CONNECTED GMAIL ACCOUNTS</Text>
      {gmails.map((email, i) => (
        <View key={i} style={styles.row}>
          <Ionicons name="mail" size={18} color="#4A9E6B" />
          <Text style={{ flex:1, fontSize:14, color:"#5C4033", marginLeft:10 }}>{email}</Text>
          <Text style={{ color:"#4A9E6B", fontWeight:"600" }}>✓</Text>
        </View>
      ))}
      <TouchableOpacity style={styles.addBtn} onPress={handleAddGmail}>
        <Ionicons name="add-circle-outline" size={20} color="#E8734A" />
        <Text style={{ color:"#E8734A", fontWeight:"600", fontSize:14 }}>Add family Gmail</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.scanBtn} onPress={handleScanAll} disabled={scanning}>
        <Ionicons name="refresh" size={18} color="#fff" />
        <Text style={{ color:"#fff", fontWeight:"600", fontSize:14 }}>
          {scanning ? "Scanning..." : "Scan all Gmail accounts"}
        </Text>
      </TouchableOpacity>

      <Text style={styles.section}>CHILDREN</Text>
      {children.length === 0
        ? <Text style={{ color:"#A0856B", fontStyle:"italic" }}>No profiles yet</Text>
        : children.map((c: any) => (
          <View key={c.id} style={styles.childCard}>
            <Text style={styles.childName}>{c.name}</Text>
            <Text style={{ fontSize:13, color:"#A0856B" }}>
              {[c.grade && "Grade " + c.grade, c.school].filter(Boolean).join(" · ")}
            </Text>
          </View>
        ))
      }

      <Text style={styles.section}>SHARE HEARTH</Text>
      <TouchableOpacity style={styles.shareBtn}
        onPress={() => Share.share({ message: `Try Hearth — Family OS!\n\nDownload: ${APK_URL}` })}>
        <Ionicons name="share-social" size={20} color="#fff" />
        <Text style={{ color:"#fff", fontWeight:"700", fontSize:15 }}>Invite a friend</Text>
      </TouchableOpacity>
      <Text style={{ fontSize:12, color:"#A0856B", marginTop:10, textAlign:"center", lineHeight:18 }}>
        Friends sign in with their own Google account and get their own private calendar.
      </Text>

      <Text style={styles.section}>ACCOUNT</Text>
      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Ionicons name="log-out-outline" size={20} color="#E84A4A" />
        <Text style={{ color:"#E84A4A", fontWeight:"600", fontSize:15 }}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll:    { flex:1, backgroundColor:"#FFF8F0" },
  content:   { padding:20, paddingTop:60, paddingBottom:60 },
  userCard:  { flexDirection:"row", alignItems:"center", backgroundColor:"#fff",
               borderRadius:16, padding:16, marginBottom:24, elevation:2 },
  avatar:    { width:56, height:56, borderRadius:28, backgroundColor:"#E8734A",
               alignItems:"center", justifyContent:"center" },
  avatarText:{ color:"#fff", fontSize:24, fontWeight:"700" },
  userName:  { fontSize:18, fontWeight:"700", color:"#8B4513" },
  userEmail: { fontSize:13, color:"#A0856B", marginTop:2 },
  section:   { fontSize:11, fontWeight:"700", color:"#A0856B",
               letterSpacing:1.5, marginBottom:10, marginTop:24 },
  row:       { flexDirection:"row", alignItems:"center", backgroundColor:"#fff",
               borderRadius:12, padding:14, marginBottom:8, elevation:1 },
  addBtn:    { flexDirection:"row", alignItems:"center", gap:8, padding:14,
               borderRadius:12, borderWidth:1.5, borderColor:"#E8734A",
               borderStyle:"dashed", justifyContent:"center", marginTop:4 },
  scanBtn:   { flexDirection:"row", alignItems:"center", gap:8,
               backgroundColor:"#4A7BE8", borderRadius:12,
               padding:14, justifyContent:"center", marginTop:10 },
  childCard: { backgroundColor:"#fff", borderRadius:12, padding:14,
               marginBottom:8, elevation:1 },
  childName: { fontSize:16, fontWeight:"700", color:"#8B4513" },
  shareBtn:  { flexDirection:"row", alignItems:"center", gap:10,
               backgroundColor:"#E8734A", borderRadius:12,
               padding:16, justifyContent:"center" },
  signOutBtn:{ flexDirection:"row", alignItems:"center", gap:10,
               backgroundColor:"#FFF0F0", borderRadius:12, padding:16 },
});
