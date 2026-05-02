import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GOOGLE_CLIENT_ID, API_BASE_URL } from "@/constants/config";
import { User } from "@/lib/types";

WebBrowser.maybeCompleteAuthSession();

const discovery = AuthSession.useAutoDiscovery("https://accounts.google.com");

export async function signInWithGoogle(): Promise<User | null> {
  const redirectUri = AuthSession.makeRedirectUri({
    useProxy: true,
  });

  const request = new AuthSession.AuthRequest({
    clientId: GOOGLE_CLIENT_ID,
    redirectUri,
    scopes: [
      "openid",
      "profile", 
      "email",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/calendar",
    ],
  });

  const result = await request.promptAsync({
    authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  }, { useProxy: true });

  if (result.type !== "success") return null;

  // Get user info
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code:          result.params.code,
      client_id:     GOOGLE_CLIENT_ID,
      redirect_uri:  redirectUri,
      grant_type:    "authorization_code",
      code_verifier: request.codeVerifier || "",
    }).toString(),
  });
  const tokenData = await tokenRes.json();

  const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const userInfo = await userRes.json();

  const user: User = {
    user_id: userInfo.sub,
    email:   userInfo.email,
    name:    userInfo.name,
    picture: userInfo.picture,
  };

  // Save locally
  await AsyncStorage.setItem("hearth_user",    JSON.stringify(user));
  await AsyncStorage.setItem("google_token",   tokenData.access_token);
  await AsyncStorage.setItem("google_refresh", tokenData.refresh_token || "");

  // Register with backend + send token so backend can scan Gmail
  await fetch(`${API_BASE_URL}/auth/register`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ user, access_token: tokenData.access_token }),
  });

  return user;
}

export async function loadSavedUser(): Promise<User | null> {
  try {
    const raw = await AsyncStorage.getItem("hearth_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function signOut(): Promise<void> {
  await AsyncStorage.multiRemove(["hearth_user", "google_token", "google_refresh"]);
}

export async function isSignedIn(): Promise<boolean> {
  const token = await AsyncStorage.getItem("google_token");
  return !!token;
}
