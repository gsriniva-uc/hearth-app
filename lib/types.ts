/**
 * lib/types.ts — Shared TypeScript types across the app
 */

export interface User {
  user_id:  string;
  email:    string;
  name:     string;
  picture?: string;
}

export interface Child {
  id:          number;
  name:        string;
  grade?:      string;
  school?:     string;
  activities?: string;
}

export type EventType =
  | "dress_down_day"
  | "early_dismissal"
  | "recital"
  | "movie_night"
  | "field_trip"
  | "special_day"
  | "doctor_appointment"
  | "sports_game"
  | "school_holiday"
  | "bill_due"
  | "other";

export interface HearthEvent {
  id:             number;
  child_name:     string;
  event_type:     EventType;
  event_date:     string;   // YYYY-MM-DD
  event_time?:    string;   // HH:MM
  notes?:         string;
  nudge_sent_7d:  boolean;
  nudge_sent_48h: boolean;
  nudge_sent_day: boolean;
  gcal_event_id?: string;
}

export type TaskType =
  | "email_draft"
  | "form_submit"
  | "payment"
  | "call"
  | "reminder"
  | "follow_up";

export type TaskStatus = "pending" | "snoozed" | "sent" | "done";

export interface Task {
  id:              number;
  task_type:       TaskType;
  title:           string;
  due_date?:       string;
  status:          TaskStatus;
  // Email draft fields
  draft_to?:       string;
  draft_subject?:  string;
  draft_body?:     string;
  // Payment fields
  payment_url?:    string;
  amount?:         string;
  // Recurrence
  recurrence?:     "daily" | "weekly" | "monthly" | "custom";
  recurrence_days?: number;
  source:          "gmail_pattern" | "user_voice" | "user_typed" | "calendar";
}

export interface Briefing {
  today:     HearthEvent[];
  tomorrow:  HearthEvent[];
  this_week: HearthEvent[];
  tasks:     Task[];
  text:      string;
}
