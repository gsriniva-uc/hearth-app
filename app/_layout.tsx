import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { loadSavedUser } from "@/lib/auth";
import { User } from "@/lib/types";

export let globalUser: User | null = null;
export function setGlobalUser(u: User | null) { globalUser = u; }

export default function RootLayout() {
  const [user,    setUser]    = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSavedUser().then((saved) => {
      setUser(saved);
      globalUser = saved;
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <View style={{ flex:1, alignItems:"center", justifyContent:"center",
                     backgroundColor:"#FFF8F0" }}>
        <ActivityIndicator size="large" color="#E8734A" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {user
        ? <Stack.Screen name="(tabs)" />
        : <Stack.Screen name="(auth)/login" />
      }
    </Stack>
  );
}
