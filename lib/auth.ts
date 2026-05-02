import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GOOGLE_CLIENT_ID, API_BASE_URL } from "@/constants/config";
import { User } from "@/lib/types";

WebBrowser.maybeCompleteAuthSession();

export async function signInWithGoogle(): Promise<User | null> {
  const redirectUri = "https://auth.expo.io/@gsriniva/hearth-fresh";

  const authUrl = 
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${GOOGLE_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=token` +
    `&scope=${encodeURIComponent("openid profile email https://www.googleapis.com/auth/gmail.readonly")}`;

  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

  if (result.type !== "success") return null;

  // Extract access token from URL fragment
  const url   = result.url;
  const match = url.match(/access_token=([^&]+)/);
  if (!match) return null;
  const accessToken = match[1];

  // Get user info
  const userRes  = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const userInfo = await userRes.json();

  const user: User = {
    user_id: userInfo.sub,
    email:   userInfo.email,
    name:    userInfo.name,
    picture: userInfo.picture,
  };

  await AsyncStorage.setItem("hearth_user",  JSON.stringify(user));
  await AsyncStorage.setItem("google_token", accessToken);

  await fetch(`${API_BASE_URL}/auth/register`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ user, access_token: accessToken }),
  });

  return user;
}

export async function loadSavedUser(): Promise<User | null> {
  try {
    const raw = await AsyncStorage.getItem("hearth_user");
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export async function signOut(): Promise<void> {
  await AsyncStorage.multiRemove(["hearth_user", "google_token"]);
}

export async function isSignedIn(): Promise<boolean> {
  const token = await AsyncStorage.getItem("google_token");
  return !!token;
}
