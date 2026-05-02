import { useEffect, useState, useCallback } from "react";
import { Stack } from "expo-router";
import { View, ActivityIndicator, Linking } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface User {
  user_id: string;
  email:   string;
  name:    string;
  picture?: string;
}

export let globalUser: User | null = null;
export function setGlobalUser(u: User | null) { globalUser = u; }

export default function RootLayout() {
  const [user,    setUser]    = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const handleDeepLink = useCallback(async (url: string) => {
    if (!url.includes("://auth")) return;
    const userMatch  = url.match(/user=([^&]+)/);
    const tokenMatch = url.match(/token=([^&]+)/);
    if (!userMatch || !tokenMatch) return;
    try {
      const userData = JSON.parse(decodeURIComponent(userMatch[1])) as User;
      const token    = decodeURIComponent(tokenMatch[1]);
      await AsyncStorage.setItem("hearth_user",  JSON.stringify(userData));
      await AsyncStorage.setItem("google_token", token);
      globalUser = userData;
      setUser(userData);
    } catch (e) {
      console.error("Deep link parse error:", e);
    }
  }, []);

  useEffect(() => {
    // Load saved user
    AsyncStorage.getItem("hearth_user").then((raw) => {
      if (raw) {
        const saved = JSON.parse(raw) as User;
        globalUser  = saved;
        setUser(saved);
      }
      setLoading(false);
    });

    // Handle deep link when app is already open
    const sub = Linking.addEventListener("url", ({ url }) => handleDeepLink(url));

    // Handle deep link that opened the app
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });

    return () => sub.remove();
  }, [handleDeepLink]);

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
