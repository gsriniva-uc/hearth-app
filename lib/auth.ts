/**
 * lib/auth.ts
 *
 * Google Sign-In using Expo AuthSession.
 * Stores user info in SecureStore (encrypted on device).
 *
 * Beginner note: SecureStore is like a safe on the phone —
 * much more secure than AsyncStorage for sensitive data.
 */

import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import * as SecureStore from "expo-secure-store";
import { GOOGLE_CLIENT_ID_IOS, GOOGLE_CLIENT_ID_ANDROID, API_BASE_URL } from "@/constants/config";
import { User } from "@/lib/types";
import { Platform } from "react-native";

WebBrowser.maybeCompleteAuthSession();

const CLIENT_ID = Platform.OS === "ios"
  ? GOOGLE_CLIENT_ID_IOS
  : GOOGLE_CLIENT_ID_ANDROID;

const discovery = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint:         "https://oauth2.googleapis.com/token",
  userInfoEndpoint:      "https://www.googleapis.com/oauth2/v3/userinfo",
};

// ── Sign In ───────────────────────────────────────────────────────────────────

export async function signInWithGoogle(): Promise<User | null> {
  const redirectUri = AuthSession.makeRedirectUri({ scheme: "hearth" });

  const request = new AuthSession.AuthRequest({
    clientId:    CLIENT_ID,
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

  const result = await request.promptAsync(discovery);

  if (result.type !== "success") {
    return null;
  }

  // Exchange code for tokens
  const tokenResult = await AuthSession.exchangeCodeAsync(
    {
      clientId:    CLIENT_ID,
      redirectUri,
      code:        result.params.code,
      extraParams: { code_verifier: request.codeVerifier! },
    },
    discovery
  );

  // Get user info from Google
  const userInfoRes = await fetch(discovery.userInfoEndpoint, {
    headers: { Authorization: `Bearer ${tokenResult.accessToken}` },
  });
  const userInfo = await userInfoRes.json();

  const user: User = {
    user_id: userInfo.sub,
    email:   userInfo.email,
    name:    userInfo.name,
    picture: userInfo.picture,
  };

  // Store token + user securely on device
  await SecureStore.setItemAsync("google_token",   tokenResult.accessToken);
  await SecureStore.setItemAsync("google_refresh",  tokenResult.refreshToken ?? "");
  await SecureStore.setItemAsync("hearth_user",     JSON.stringify(user));

  // Register user with backend
  await fetch(`${API_BASE_URL}/auth/register`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ user, access_token: tokenResult.accessToken }),
  });

  return user;
}

// ── Load saved session ────────────────────────────────────────────────────────

export async function loadSavedUser(): Promise<User | null> {
  try {
    const raw = await SecureStore.getItemAsync("hearth_user");
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

// ── Sign Out ──────────────────────────────────────────────────────────────────

export async function signOut(): Promise<void> {
  await SecureStore.deleteItemAsync("google_token");
  await SecureStore.deleteItemAsync("google_refresh");
  await SecureStore.deleteItemAsync("hearth_user");
}

// ── Check if signed in ────────────────────────────────────────────────────────

export async function isSignedIn(): Promise<boolean> {
  const token = await SecureStore.getItemAsync("google_token");
  return !!token;
}
