import { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, Linking, Share, TextInput, Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/app/_layout";
import { API_BASE_URL } from "@/constants/config";

const APK_URL = "https://expo.dev/accounts/gsriniva/projects/hearth-app-gs-aliq2kjh1s8wphd0xuvka/builds/392c23ab-ac12-4042-b184-8842bf7a9e02";

const campStyles = StyleSheet.create({
  overlay:  { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  card:     { backgroundColor: "#FFF8F0", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  handle:   { width: 36, height: 4, backgroundColor: "#C0C0C0", borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  title:    { fontSize: 22, fontWeight: "800", color: "#8B4513", marginBottom: 8, fontFamily: "Georgia" },
  body:     { fontSize: 14, color: "#5C4033", lineHeight: 22, marginBottom: 16 },
  hint:     { fontSize: 13, color: "#A0856B", marginBottom: 16, fontStyle: "italic" },
  input:    { borderWidth: 1, borderColor: "#E8E8E8", borderRadius: 14, padding: 12, fontSize: 14, color: "#333", backgroundColor: "#fff", minHeight: 100, textAlignVertical: "top", marginBottom: 16 },
  btn:      { backgroundColor: "#E8734A", borderRadius: 14, paddingVertical: 14, alignItems: "center", marginBottom: 8 },
  btnText:  { color: "#fff", fontWeight: "700", fontSize: 15 },
  skip:     { alignItems: "center", paddingVertical: 8 },
  skipText: { color: "#A0856B", fontSize: 14 },
});

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [children,  setChildren]  = useState<any[]>([]);
  const [gmails,    setGmails]    = useState<string[]>([]);
  const [scanning,  setScanning]  = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [childName, setChildName] = useState("");
  const [childGrade,setChildGrade]= useState("");
  const [saving,    setSaving]    = useState(false);

  useEffect(() => {
    if (!user) return;
    loadChildren();
    fetch(`${API_BASE_URL}/connected-gmails?user_id=${user.user_id}`)
      .then(r => r.json()).then(d => setGmails(d.emails || [user.email]))
      .catch(() => setGmails([user?.email || ""]));
  }, [user]);

  function loadChildren() {
    if (!user) return;
    fetch(`${API_BASE_URL}/profiles?user_id=${user.user_id}`)
      .then(r => r.json()).then(setChildren).catch(console.error);
  }

  async function handleAddChild() {
    if (!childName.trim()) {
      Alert.alert("Please enter a name");
      return;
    }
    setSaving(true);
    try {
      await fetch(`${API_BASE_URL}/profiles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user?.user_id,
          name:    childName.trim(),
          grade:   childGrade.trim() || null,
        }),
      });
      setChildName("");
      setChildGrade("");
      setShowModal(false);
      loadChildren();
    } catch {
      Alert.alert("Error", "Could not save child profile.");
    } finally {
      setSaving(false);
    }
  }

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

  useEffect(() => {
    if (!user) return;
    fetch(`${API_BASE_URL}/profiles?user_id=${user.user_id}`)
      .then(r => r.json()).then(setChildren).catch(() => {});
  }, [user]);

  async function handleScanAll() {
    if (!user) return;
    setScanning(true);
    try {
      const [gmailRes, gcalRes] = await Promise.all([
        fetch(`${API_BASE_URL}/gmail/scan-all?user_id=${user.user_id}`, { method: "POST" }),
        fetch(`${API_BASE_URL}/gcal/sync?user_id=${user.user_id}`, { method: "POST" }),
      ]);
      const gmail = await gmailRes.json();
      const gcal  = await gcalRes.json();
      const total = (gmail.new || 0) + (gcal.new || 0);

      // Check for token expiry errors
      const expiredAccounts = (gmail.errors || []).filter((e: any) => e.error === "token_expired");
      if (expiredAccounts.length > 0) {
        Alert.alert(
          "Gmail reconnection needed",
          `${expiredAccounts[0].email} needs to reconnect. Tap OK to reconnect.`,
          [
            { text: "Cancel", style: "cancel" },
            { text: "Reconnect", onPress: () =>
                Linking.openURL(expiredAccounts[0].reauth_url) }
          ]
        );
      } else {
        Alert.alert("Sync complete", `Found ${total} new event(s) from Gmail and Google Calendar.`);
      }
    } catch {
      Alert.alert("Error", "Scan failed. Please check your internet connection.");
    } finally {
      setScanning(false);
    }
  }

  if (!user) return null;

  return (
    <>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

      {/* User card */}
      <View style={styles.userCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user.name[0]}</Text>
        </View>
        <View style={{ marginLeft:14, flex:1 }}>
          <Text style={styles.userName}>{user.name}</Text>
          <Text style={styles.userEmail}>{user.email}</Text>
        </View>
      </View>

      {/* Connected Gmail */}
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
          {scanning ? "Scanning..." : "Scan Gmail + Google Calendar"}
        </Text>
      </TouchableOpacity>

      {/* Children */}
      <Text style={styles.section}>CHILDREN</Text>
      {children.length === 0
        ? <Text style={{ color:"#A0856B", fontStyle:"italic", marginBottom:8 }}>No children added yet</Text>
        : children.map((c: any) => (
          <View key={c.id} style={styles.childCard}>
            <Text style={styles.childName}>{c.name}</Text>
            {c.grade ? <Text style={{ fontSize:13, color:"#A0856B" }}>Grade {c.grade}</Text> : null}
          </View>
        ))
      }
      <TouchableOpacity style={styles.addBtn} onPress={() => setShowModal(true)}>
        <Ionicons name="add-circle-outline" size={20} color="#E8734A" />
        <Text style={{ color:"#E8734A", fontWeight:"600", fontSize:14 }}>Add a child</Text>
      </TouchableOpacity>

      {/* Share */}
      <Text style={styles.section}>SHARE HEARTH</Text>
      <TouchableOpacity style={styles.shareBtn}
        onPress={() => Share.share({ message: `Try Hearth — Family OS!\n\nDownload: ${APK_URL}` })}>
        <Ionicons name="share-social" size={20} color="#fff" />
        <Text style={{ color:"#fff", fontWeight:"700", fontSize:15 }}>Invite a friend</Text>
      </TouchableOpacity>

      {/* Sign out */}
      <Text style={styles.section}>ACCOUNT</Text>
      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Ionicons name="log-out-outline" size={20} color="#E84A4A" />
        <Text style={{ color:"#E84A4A", fontWeight:"600", fontSize:15 }}>Sign out</Text>
      </TouchableOpacity>

      {/* Add Child Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Add a Child</Text>
            <TextInput style={styles.input} placeholder="Child's name"
              placeholderTextColor="#A0856B" value={childName}
              onChangeText={setChildName} />
            <TextInput style={styles.input} placeholder="Grade (optional)"
              placeholderTextColor="#A0856B" value={childGrade}
              onChangeText={setChildGrade} />
            <TouchableOpacity style={styles.saveBtn} onPress={handleAddChild}
              disabled={saving}>
              <Text style={{ color:"#fff", fontWeight:"700", fontSize:16 }}>
                {saving ? "Saving..." : "Save"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowModal(false)}
              style={{ alignItems:"center", marginTop:12 }}>
              <Text style={{ color:"#A0856B" }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </ScrollView>

      {/* Camp Collection Modal */}
      <Modal visible={showCampModal} transparent animationType="slide">
        <View style={campStyles.overlay}>
          <View style={campStyles.card}>
            <View style={campStyles.handle} />

            {campStep === "intro" && (
              <>
                <Text style={campStyles.title}>🏕️ Add Camps</Text>
                <Text style={campStyles.body}>
                  Let Hearth track camp registration deadlines and send reminders for each of your kids.
                </Text>
                {children.length === 0 ? (
                  <Text style={campStyles.hint}>Add children in the Family tab first.</Text>
                ) : (
                  <TouchableOpacity style={campStyles.btn} onPress={() => {
                    setCampChildIndex(0);
                    setCampMessage("What camps is " + children[0].name + " doing? Include registration deadlines and camp dates if you know them.");
                    setCampStep("collecting");
                  }}>
                    <Text style={campStyles.btnText}>Let's start →</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setShowCampModal(false)} style={campStyles.skip}>
                  <Text style={campStyles.skipText}>Maybe later</Text>
                </TouchableOpacity>
              </>
            )}

            {campStep === "collecting" && (
              <>
                <Text style={campStyles.title}>
                  🧒 {children[campChildIndex]?.name}
                </Text>
                <Text style={campStyles.body}>{campMessage}</Text>
                <TextInput
                  style={campStyles.input}
                  placeholder="e.g. Code Wiz July 14-18, deadline May 30. Science camp June 23-27..."
                  placeholderTextColor="#A0856B"
                  value={campInput}
                  onChangeText={setCampInput}
                  multiline
                  numberOfLines={4}
                />
                <TouchableOpacity
                  style={[campStyles.btn, campLoading && { opacity: 0.6 }]}
                  disabled={campLoading}
                  onPress={async () => {
                    if (!campInput.trim()) {
                      // Skip this child
                      if (campChildIndex < children.length - 1) {
                        setCampChildIndex(campChildIndex + 1);
                        setCampMessage("What camps is " + children[campChildIndex + 1].name + " doing?");
                        setCampInput("");
                      } else {
                        setCampStep("done");
                      }
                      return;
                    }
                    setCampLoading(true);
                    try {
                      const child = children[campChildIndex];
                      const parseRes = await fetch(`${API_BASE_URL}/camps/parse`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          user_id: user?.user_id,
                          child_name: child.name,
                          text: campInput.trim(),
                        }),
                      });
                      const parsed = await parseRes.json();
                      const camps = parsed.camps || [];

                      // Save each camp
                      for (const camp of camps) {
                        await fetch(`${API_BASE_URL}/camps`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            user_id: user?.user_id,
                            child_name: child.name,
                            ...camp,
                          }),
                        });
                      }

                      setCampInput("");
                      if (campChildIndex < children.length - 1) {
                        setCampChildIndex(campChildIndex + 1);
                        setCampMessage("Got it! " + camps.length + " camp(s) saved for " + child.name + ". What camps is " + children[campChildIndex + 1].name + " doing?");
                      } else {
                        // Trigger URL search in background
                        fetch(`${API_BASE_URL}/camps/search-urls?user_id=${user?.user_id}`, { method: "POST" });
                        setCampStep("done");
                      }
                    } catch {
                      Alert.alert("Error", "Could not save camps. Try again.");
                    } finally {
                      setCampLoading(false);
                    }
                  }}>
                  {campLoading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={campStyles.btnText}>
                        {campInput.trim() ? "Save & continue →" : "Skip this child →"}
                      </Text>}
                </TouchableOpacity>
              </>
            )}

            {campStep === "done" && (
              <>
                <Text style={campStyles.title}>✅ All done!</Text>
                <Text style={campStyles.body}>
                  Hearth will search for registration links and send reminders as deadlines approach. Check the Actions tab to see your camps.
                </Text>
                <TouchableOpacity style={campStyles.btn} onPress={() => {
                  setShowCampModal(false);
                  setCampStep("intro");
                  setCampChildIndex(0);
                  setCampInput("");
                }}>
                  <Text style={campStyles.btnText}>Done</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

    </>
  );
}

const styles = StyleSheet.create({
  scroll:       { flex:1, backgroundColor:"#FFF8F0" },
  content:      { padding:20, paddingTop:60, paddingBottom:60 },
  userCard:     { flexDirection:"row", alignItems:"center", backgroundColor:"#fff",
                  borderRadius:16, padding:16, marginBottom:24, elevation:2 },
  avatar:       { width:56, height:56, borderRadius:28, backgroundColor:"#E8734A",
                  alignItems:"center", justifyContent:"center" },
  avatarText:   { color:"#fff", fontSize:24, fontWeight:"700" },
  userName:     { fontSize:18, fontWeight:"700", color:"#8B4513" },
  userEmail:    { fontSize:13, color:"#A0856B", marginTop:2 },
  section:      { fontSize:11, fontWeight:"700", color:"#A0856B",
                  letterSpacing:1.5, marginBottom:10, marginTop:24 },
  row:          { flexDirection:"row", alignItems:"center", backgroundColor:"#fff",
                  borderRadius:12, padding:14, marginBottom:8, elevation:1 },
  addBtn:       { flexDirection:"row", alignItems:"center", gap:8, padding:14,
                  borderRadius:12, borderWidth:1.5, borderColor:"#E8734A",
                  borderStyle:"dashed", justifyContent:"center", marginTop:4 },
  scanBtn:      { flexDirection:"row", alignItems:"center", gap:8,
                  backgroundColor:"#4A7BE8", borderRadius:12,
                  padding:14, justifyContent:"center", marginTop:10 },
  childCard:    { backgroundColor:"#fff", borderRadius:12, padding:14,
                  marginBottom:8, elevation:1 },
  childName:    { fontSize:16, fontWeight:"700", color:"#8B4513" },
  shareBtn:     { flexDirection:"row", alignItems:"center", gap:10,
                  backgroundColor:"#E8734A", borderRadius:12,
                  padding:16, justifyContent:"center" },
  signOutBtn:   { flexDirection:"row", alignItems:"center", gap:10,
                  backgroundColor:"#FFF0F0", borderRadius:12, padding:16 },
  modalOverlay: { flex:1, backgroundColor:"rgba(0,0,0,0.5)",
                  justifyContent:"center", padding:24 },
  modalBox:     { backgroundColor:"#FFF8F0", borderRadius:20, padding:24 },
  modalTitle:   { fontSize:20, fontWeight:"800", color:"#8B4513",
                  marginBottom:20, textAlign:"center" },
  input:        { backgroundColor:"#fff", borderRadius:12, padding:14,
                  fontSize:15, color:"#5C4033", borderWidth:1,
                  borderColor:"#F5E6D3", marginBottom:12 },
  saveBtn:      { backgroundColor:"#E8734A", borderRadius:12,
                  padding:16, alignItems:"center" },
});
