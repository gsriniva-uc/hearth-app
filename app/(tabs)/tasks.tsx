import { View, Text, StyleSheet } from "react-native";
export default function TasksScreen() {
  return (
    <View style={styles.c}>
      <Text style={styles.emoji}>✅</Text>
      <Text style={styles.title}>Actions</Text>
      <Text style={styles.sub}>Email drafts, bills, and follow-ups will appear here</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  c:     { flex:1, alignItems:"center", justifyContent:"center", backgroundColor:"#FFF8F0" },
  emoji: { fontSize:48 },
  title: { fontSize:28, fontWeight:"800", color:"#8B4513", marginTop:12 },
  sub:   { fontSize:14, color:"#A0856B", marginTop:8, textAlign:"center", paddingHorizontal:40 },
});
