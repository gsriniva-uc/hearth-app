import { View, Text } from "react-native";

export default function HomeScreen() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#FFF8F0" }}>
      <Text style={{ fontSize: 48 }}>🏠</Text>
      <Text style={{ fontSize: 28, fontWeight: "bold", color: "#8B4513" }}>Hearth</Text>
      <Text style={{ fontSize: 16, color: "#A0856B", marginTop: 8 }}>Family OS</Text>
    </View>
  );
}
