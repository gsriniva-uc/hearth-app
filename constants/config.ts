/**
 * constants/config.ts
 * Central config — update API_BASE_URL when deployed to Render
 */
export const API_BASE_URL = __DEV__
  ? "http://localhost:8000"
  : "https://hearth-api.onrender.com"; // ← update this after Render deploy

export const GOOGLE_CLIENT_ID_IOS     = "YOUR_IOS_CLIENT_ID.apps.googleusercontent.com";
export const GOOGLE_CLIENT_ID_ANDROID = "YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com";

export const APP_NAME    = "Hearth";
export const APP_VERSION = "1.0.0";
export const BRIEFING_HOUR = 7;
