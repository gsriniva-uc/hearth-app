/**
 * app/(tabs)/profile.tsx — Family + Settings screen
 */
import { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, Alert, StyleSheet, Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { globalUser, setGlobalUser } from "@/app/_layout";
import { signOut } from "@/lib/auth";
import { getChildren, saveChild } from "@/lib/api";
import { Child } from "@/lib/types";

export default function ProfileScreen() {
  const insets  = useSafeAreaInsets();
  const router  = useRouter();
  const user    = globalUser!;

  const [children,   setChildren]   = useState<Child[]>([]);
  const [showForm,   setShowForm]   = useState(false);
  const [name,       setName]       = useState("");
  const [grade,      setGrade]      = useState("");
  const [school,     setSchool]     = useState("");
  const [activities, setActivities] = useState("");

  useEffect(() => {
    getChildren(user.user_id).then(setChildren).catch(console.error);
  }, [user.user_id]);

  async function handleSaveChild() {
    if (!name.trim()) { Alert.alert("Name required"); return; }
    try {
      await saveChild(user.user_id, { name, grade, school, activities });
      const updated = await getChildren(user.user_id);
      setChildren(updated);
      setShowForm(false);
      setName(""); setGrade(""); setSchool(""); setActivities("");
    } catch {
      Alert.alert("Error", "Could not save profile.");
    }
  }

  async function handleSignOut() {
    Alert.alert("Sign out", "Are you sure?", [
      { text:"Cancel", style:"cancel" },
      { text:"Sign out", style:"destructive", onPress: async () => {
        await signOut();
        setGlobalUser(null);
        router.replace("/(auth)/login");
      }},
    ]);
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
    >
      {/* User card */}
      <View style={styles.userCard}>
        {user.picture ? (
          <Image source={{ uri: user.picture }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarText}>{user.name[0]}</Text>
          </View>
        )}
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{user.name}</Text>
          <Text style={styles.userEmail}>{user.email}</Text>
        </View>
      </View>

      {/* Children */}
      <Text style={styles.sectionTitle}>CHILDREN</Text>
      {children.map(child => (
        <View key={child.id} style={styles.childCard}>
          <Text style={styles.childName}>{child.name}</Text>
          <Text style={styles.childDetail}>
            {[child.grade && `Grade ${child.grade}`,
              child.school,
              child.activities
            ].filter(Boolean).join(" · ")}
          </Text>
        </View>
      ))}

      {showForm ? (
        <View style={styles.form}>
          <TextInput style={styles.input} placeholder="Child's name *"
            value={name} onChangeText={setName} placeholderTextColor="#A0856B" />
          <TextInput style={styles.input} placeholder="Grade (e.g. 3rd)"
            value={grade} onChangeText={setGrade} placeholderTextColor="#A0856B" />
          <TextInput style={styles.input} placeholder="School name"
            value={school} onChangeText={setSchool} placeholderTextColor="#A0856B" />
          <TextInput style={styles.input} placeholder="Activities (e.g. soccer, piano)"
            value={activities} onChangeText={setActivities} placeholderTextColor="#A0856B" />
          <View style={styles.formButtons}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowForm(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveChild}>
              <Text style={styles.saveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(true)}>
          <Ionicons name="add-circle-outline" size={20} color="#E8734A" />
          <Text style={styles.addText}>Add a child</Text>
        </TouchableOpacity>
      )}

      {/* Sign out */}
      <Text style={styles.sectionTitle}>ACCOUNT</Text>
      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Ionicons name="log-out-outline" size={20} color="#E84A4A" />
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll:         { flex:1, backgroundColor:"#FFF8F0" },
  content:        { padding:20, paddingBottom:60 },
  userCard:       { flexDirection:"row", alignItems:"center", backgroundColor:"#fff",
                    borderRadius:16, padding:16, marginBottom:24,
                    shadowColor:"#000", shadowOpacity:0.05, shadowRadius:8 },
  avatar:         { width:56, height:56, borderRadius:28 },
  avatarFallback: { width:56, height:56, borderRadius:28, backgroundColor:"#E8734A",
                    alignItems:"center", justifyContent:"center" },
  avatarText:     { color:"#fff", fontSize:24, fontWeight:"700" },
  userInfo:       { marginLeft:14 },
  userName:       { fontSize:18, fontWeight:"700", color:"#8B4513" },
  userEmail:      { fontSize:13, color:"#A0856B", marginTop:2 },
  sectionTitle:   { fontSize:11, fontWeight:"700", color:"#A0856B",
                    letterSpacing:1.5, marginBottom:12, marginTop:8 },
  childCard:      { backgroundColor:"#fff", borderRadius:12, padding:14,
                    marginBottom:8, shadowColor:"#000", shadowOpacity:0.04,
                    shadowRadius:4 },
  childName:      { fontSize:16, fontWeight:"700", color:"#8B4513" },
  childDetail:    { fontSize:13, color:"#A0856B", marginTop:2 },
  addBtn:         { flexDirection:"row", alignItems:"center", gap:8,
                    padding:14, borderRadius:12, borderWidth:1.5,
                    borderColor:"#E8734A", borderStyle:"dashed",
                    justifyContent:"center", marginTop:4 },
  addText:        { color:"#E8734A", fontWeight:"600" },
  form:           { backgroundColor:"#fff", borderRadius:16, padding:16,
                    marginTop:4, gap:10 },
  input:          { backgroundColor:"#FFF8F0", borderRadius:10, padding:14,
                    fontSize:14, color:"#5C4033", borderWidth:1,
                    borderColor:"#F5E6D3" },
  formButtons:    { flexDirection:"row", gap:10, marginTop:4 },
  cancelBtn:      { flex:1, padding:14, borderRadius:10, alignItems:"center",
                    backgroundColor:"#F5E6D3" },
  cancelText:     { color:"#8B4513", fontWeight:"600" },
  saveBtn:        { flex:1, padding:14, borderRadius:10, alignItems:"center",
                    backgroundColor:"#E8734A" },
  saveText:       { color:"#fff", fontWeight:"700" },
  signOutBtn:     { flexDirection:"row", alignItems:"center", gap:10,
                    backgroundColor:"#FFF0F0", borderRadius:12, padding:16 },
  signOutText:    { color:"#E84A4A", fontWeight:"600", fontSize:15 },
});
