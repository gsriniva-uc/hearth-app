import { View, Text, StyleSheet } from "react-native";
export default function WeekScreen() {
  return (
    <View style={styles.c}>
      <Text style={styles.emoji}>📅</Text>
      <Text style={styles.title}>This Week</Text>
      <Text style={styles.sub}>Upcoming school events will appear here</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  c:     { flex:1, alignItems:"center", justifyContent:"center", backgroundColor:"#FFF8F0" },
  emoji: { fontSize:48 },
  title: { fontSize:28, fontWeight:"800", color:"#8B4513", marginTop:12 },
  sub:   { fontSize:14, color:"#A0856B", marginTop:8, textAlign:"center", paddingHorizontal:40 },
});
