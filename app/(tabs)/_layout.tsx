import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function TabLayout() {
  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor:   "#E8734A",
      tabBarInactiveTintColor: "#A0856B",
      tabBarStyle:  { backgroundColor:"#FFF8F0", borderTopColor:"#F5E6D3" },
      headerStyle:  { backgroundColor:"#FFF8F0" },
      headerTintColor:  "#8B4513",
      headerTitleStyle: { fontWeight:"700" },
      headerShadowVisible: false,
    }}>
      <Tabs.Screen name="index"
        options={{ title:"Today",
          tabBarIcon: ({ color, size }) =>
            <Ionicons name="home" size={size} color={color} /> }} />
      <Tabs.Screen name="week"
        options={{ title:"Upcoming",
          tabBarIcon: ({ color, size }) =>
            <Ionicons name="calendar" size={size} color={color} /> }} />
      <Tabs.Screen name="tasks"
        options={{ title:"Actions",
          tabBarIcon: ({ color, size }) =>
            <Ionicons name="checkmark-circle" size={size} color={color} /> }} />
      <Tabs.Screen name="profile"
        options={{ title:"Family",
          tabBarIcon: ({ color, size }) =>
            <Ionicons name="people" size={size} color={color} /> }} />
    </Tabs>
  );
}
