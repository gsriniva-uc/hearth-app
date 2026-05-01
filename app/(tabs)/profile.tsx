import { View, Text, StyleSheet } from "react-native";
export default function TodayScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🏠</Text>
      <Text style={styles.title}>Today</Text>
      <Text style={styles.subtitle}>Backend coming soon</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex:1, alignItems:"center", justifyContent:"center", backgroundColor:"#FFF8F0" },
  emoji:     { fontSize:48 },
  title:     { fontSize:28, fontWeight:"800", color:"#8B4513", marginTop:12 },
  subtitle:  { fontSize:14, color:"#A0856B", marginTop:8 },
});
