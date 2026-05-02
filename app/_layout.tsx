import { useEffect, useState, useCallback, createContext, useContext } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { View, ActivityIndicator, Linking } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface User {
  user_id: string;
  email:   string;
  name:    string;
  picture?: string;
}

// ── Auth Context — share user across all screens ──────────────────────────────
interface AuthContextType {
  user:         User | null;
  setUser:      (u: User | null) => void;
  signOut:      () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null, setUser: () => {}, signOut: async () => {},
});

export function useAuth() { return useContext(AuthContext); }

// ── Auth guard — redirects based on login state ───────────────────────────────
function AuthGuard({ user, loading }: { user: User | null; loading: boolean }) {
  const segments = useSegments();
  const router   = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === "(auth)";
    if (!user && !inAuth) {
      router.replace("/(auth)/login");
    } else if (user && inAuth) {
      router.replace("/(tabs)");
    }
  }, [user, loading, segments]);

  return null;
}

// ── Root layout ────────────────────────────────────────────────────────────────
export default function RootLayout() {
  const [user,    setUserState] = useState<User | null>(null);
  const [loading, setLoading]   = useState(true);

  const setUser = async (u: User | null) => {
    setUserState(u);
    if (u) {
      await AsyncStorage.setItem("hearth_user", JSON.stringify(u));
    } else {
      await AsyncStorage.removeItem("hearth_user");
    }
  };

  const signOut = async () => {
    await AsyncStorage.multiRemove(["hearth_user", "google_token"]);
    setUserState(null);
  };

  const handleDeepLink = useCallback(async (url: string) => {
    if (!url.includes("://auth")) return;
    const userMatch  = url.match(/user=([^&]+)/);
    const tokenMatch = url.match(/token=([^&]+)/);
    if (!userMatch || !tokenMatch) return;
    try {
      const userData = JSON.parse(decodeURIComponent(userMatch[1])) as User;
      const token    = decodeURIComponent(tokenMatch[1]);
      await AsyncStorage.setItem("google_token", token);
      setUser(userData);
    } catch (e) {
      console.error("Deep link error:", e);
    }
  }, []);

  useEffect(() => {
    AsyncStorage.getItem("hearth_user").then((raw) => {
      if (raw) setUserState(JSON.parse(raw));
      setLoading(false);
    });
    const sub = Linking.addEventListener("url", ({ url }) => handleDeepLink(url));
    Linking.getInitialURL().then((url) => { if (url) handleDeepLink(url); });
    return () => sub.remove();
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
    <AuthContext.Provider value={{ user, setUser, signOut }}>
      <AuthGuard user={user} loading={loading} />
      <Stack screenOptions={{ headerShown: false }} />
    </AuthContext.Provider>
  );
}
