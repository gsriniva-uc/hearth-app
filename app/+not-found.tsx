import { useEffect } from "react";
import { useRouter } from "expo-router";
import { View, ActivityIndicator, Text } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Linking } from "react-native";

export default function NotFound() {
  const router = useRouter();

  useEffect(() => {
    // Run immediately, don't wait
    (async () => {
      try {
        const url = await Linking.getInitialURL();
        if (url && url.includes("user=") && url.includes("token=")) {
          const userMatch  = url.match(/user=([^&]+)/);
          const tokenMatch = url.match(/token=([^&]+)/);
          if (userMatch && tokenMatch) {
            const userData = JSON.parse(decodeURIComponent(userMatch[1]));
            const token    = decodeURIComponent(tokenMatch[1]);
            await AsyncStorage.setItem("hearth_user",  JSON.stringify(userData));
            await AsyncStorage.setItem("google_token", token);
          }
        }
      } catch (e) {
        console.error(e);
      }
      // Always redirect to tabs
      router.replace("/(tabs)");
    })();
  }, []);

  return (
    <View style={{ flex:1, alignItems:"center", justifyContent:"center",
                   backgroundColor:"#FFF8F0" }}>
      <Text style={{ fontSize:48 }}>🏠</Text>
      <ActivityIndicator size="large" color="#E8734A" style={{ marginTop:20 }} />
      <Text style={{ color:"#A0856B", marginTop:12 }}>Signing you in...</Text>
    </View>
  );
}
