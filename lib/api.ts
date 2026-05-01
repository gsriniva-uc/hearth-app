/**
 * lib/api.ts
 *
 * All calls to the Hearth FastAPI backend.
 * Every function takes user_id so the backend can scope data correctly.
 *
 * Beginner note: async/await means "wait for this to finish before continuing"
 */

import { API_BASE_URL } from "@/constants/config";
import { HearthEvent, Task, Briefing, Child } from "@/lib/types";
import * as SecureStore from "expo-secure-store";

// ── Auth header ───────────────────────────────────────────────────────────────

async function authHeaders(): Promise<Record<string, string>> {
  const token = await SecureStore.getItemAsync("google_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// ── Generic fetch wrapper ─────────────────────────────────────────────────────

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = await authHeaders();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { ...headers, ...(options?.headers ?? {}) },
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error ${response.status}: ${error}`);
  }
  return response.json() as Promise<T>;
}

// ── Events ────────────────────────────────────────────────────────────────────

export async function getUpcomingEvents(
  userId: string,
  daysAhead = 14
): Promise<HearthEvent[]> {
  return apiFetch(`/events?user_id=${userId}&days_ahead=${daysAhead}`);
}

export async function getTodayEvents(userId: string): Promise<HearthEvent[]> {
  return apiFetch(`/events/today?user_id=${userId}`);
}

export async function addEvent(
  userId: string,
  event: Partial<HearthEvent>
): Promise<HearthEvent> {
  return apiFetch("/events", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, ...event }),
  });
}

export async function deleteEvent(
  userId: string,
  eventId: number
): Promise<void> {
  await apiFetch(`/events/${eventId}?user_id=${userId}`, { method: "DELETE" });
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

export async function getPendingTasks(userId: string): Promise<Task[]> {
  return apiFetch(`/tasks?user_id=${userId}&status=pending`);
}

export async function sendDraft(userId: string, taskId: number): Promise<void> {
  await apiFetch(`/tasks/${taskId}/send?user_id=${userId}`, { method: "POST" });
}

export async function snoozeTask(
  userId: string,
  taskId: number,
  days: number
): Promise<void> {
  await apiFetch(`/tasks/${taskId}/snooze?user_id=${userId}&days=${days}`, {
    method: "POST",
  });
}

export async function markTaskDone(
  userId: string,
  taskId: number
): Promise<void> {
  await apiFetch(`/tasks/${taskId}/done?user_id=${userId}`, { method: "POST" });
}

export async function createTaskFromVoice(
  userId: string,
  transcript: string
): Promise<Task> {
  return apiFetch("/tasks/voice", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, transcript }),
  });
}

// ── Briefing ──────────────────────────────────────────────────────────────────

export async function getDailyBriefing(userId: string): Promise<Briefing> {
  return apiFetch(`/briefing?user_id=${userId}`);
}

// ── Chat / Agent ──────────────────────────────────────────────────────────────

export async function sendMessage(
  userId: string,
  message: string
): Promise<{ response: string }> {
  return apiFetch("/agent", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, raw_text: message }),
  });
}

// ── Gmail scan ────────────────────────────────────────────────────────────────

export async function triggerGmailScan(
  userId: string
): Promise<{ new: number; skipped: number }> {
  return apiFetch(`/gmail/scan?user_id=${userId}`, { method: "POST" });
}

// ── Profiles / Children ───────────────────────────────────────────────────────

export async function getChildren(userId: string): Promise<Child[]> {
  return apiFetch(`/profiles?user_id=${userId}`);
}

export async function saveChild(
  userId: string,
  child: Partial<Child>
): Promise<Child> {
  return apiFetch("/profiles", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, ...child }),
  });
}
