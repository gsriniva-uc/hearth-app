import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GOOGLE_CLIENT_ID, API_BASE_URL } from "@/constants/config";
import { User } from "@/lib/types";

WebBrowser.maybeCompleteAuthSession();

// Discovery document — static, no hook needed
const discovery = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint:         "https://oauth2.googleapis.com/token",
  userInfoEndpoint:      "https://www.googleapis.com/oauth2/v3/userinfo",
};

export async function signInWithGoogle(): Promise<User | null> {
  const redirectUri = AuthSession.makeRedirectUri({ useProxy: true });

  const request = new AuthSession.AuthRequest({
    clientId:    GOOGLE_CLIENT_ID,
    redirectUri,
    scopes: [
      "openid", "profile", "email",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/calendar",
    ],
  });

  await request.makeAuthUrlAsync(discovery);
  const result = await request.promptAsync(discovery, { useProxy: true });

  if (result.type !== "success") return null;

  // Exchange code for token
  const tokenRes = await fetch(discovery.tokenEndpoint, {
    method:  "POST",
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

  if (!tokenData.access_token) {
    console.error("Token exchange failed:", tokenData);
    return null;
  }

  // Get user info
  const userRes  = await fetch(discovery.userInfoEndpoint, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const userInfo = await userRes.json();

  const user: User = {
    user_id: userInfo.sub,
    email:   userInfo.email,
    name:    userInfo.name,
    picture: userInfo.picture,
  };

  // Persist locally
  await AsyncStorage.setItem("hearth_user",    JSON.stringify(user));
  await AsyncStorage.setItem("google_token",   tokenData.access_token);
  await AsyncStorage.setItem("google_refresh", tokenData.refresh_token || "");

  // Register with backend
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
