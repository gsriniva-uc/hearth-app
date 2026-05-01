/**
 * components/TaskCard.tsx — Action item card with Send/Pay/Done buttons
 *
 * This is the key UI component that makes Hearth valuable.
 * For email drafts: shows preview + Send button
 * For payments: shows amount + Pay Now link
 * For follow-ups: shows context + Resend / Mark done
 */
import { useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { sendDraft, snoozeTask, markTaskDone } from "@/lib/api";
import { Task } from "@/lib/types";

interface Props {
  task:     Task;
  userId:   string;
  onAction: () => void;
}

export default function TaskCard({ task, userId, onAction }: Props) {
  const [loading,   setLoading]   = useState(false);
  const [expanded,  setExpanded]  = useState(false);

  async function handleSend() {
    Alert.alert(
      "Send this email?",
      `To: ${task.draft_to}\n\n${task.draft_body?.slice(0, 200)}...`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Send", onPress: async () => {
          setLoading(true);
          try {
            await sendDraft(userId, task.id);
            Alert.alert("✅ Sent!", "Email sent successfully.");
            onAction();
          } catch {
            Alert.alert("Error", "Could not send email.");
          } finally {
            setLoading(false);
          }
        }},
      ]
    );
  }

  async function handleSnooze(days: number) {
    await snoozeTask(userId, task.id, days);
    onAction();
  }

  async function handleDone() {
    await markTaskDone(userId, task.id);
    onAction();
  }

  async function handlePay() {
    if (task.payment_url) {
      await Linking.openURL(task.payment_url);
    }
  }

  const isEmailDraft = task.task_type === "email_draft";
  const isPayment    = task.task_type === "payment";
  const isFollowUp   = task.task_type === "follow_up";

  return (
    <View style={styles.card}>
      {/* Header */}
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
      >
        <View style={styles.headerLeft}>
          <Text style={styles.typeTag}>
            {isEmailDraft ? "📧 Draft" :
             isPayment    ? "💳 Bill" :
             isFollowUp   ? "🔁 Follow-up" : "⏰ Reminder"}
          </Text>
          <Text style={styles.title}>{task.title}</Text>
          {task.due_date && (
            <Text style={styles.dueDate}>
              Due {new Date(task.due_date + "T12:00:00").toLocaleDateString("en-US",
                { month:"short", day:"numeric" })}
            </Text>
          )}
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={16} color="#A0856B"
        />
      </TouchableOpacity>

      {/* Expanded preview */}
      {expanded && isEmailDraft && (
        <View style={styles.preview}>
          <Text style={styles.previewLabel}>To:</Text>
          <Text style={styles.previewValue}>{task.draft_to}</Text>
          <Text style={styles.previewLabel}>Subject:</Text>
          <Text style={styles.previewValue}>{task.draft_subject}</Text>
          <Text style={styles.previewLabel}>Message:</Text>
          <Text style={styles.previewBody}>{task.draft_body}</Text>
        </View>
      )}

      {expanded && isPayment && (
        <View style={styles.preview}>
          <Text style={styles.amount}>{task.amount}</Text>
          {task.payment_url && (
            <Text style={styles.payUrl} numberOfLines={1}>{task.payment_url}</Text>
          )}
        </View>
      )}

      {/* Action buttons */}
      <View style={styles.actions}>
        {isEmailDraft && (
          <TouchableOpacity style={styles.primaryBtn} onPress={handleSend}
            disabled={loading}>
            {loading
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.primaryBtnText}>Send ↗</Text>
            }
          </TouchableOpacity>
        )}
        {isPayment && (
          <TouchableOpacity style={styles.primaryBtn} onPress={handlePay}>
            <Text style={styles.primaryBtnText}>Pay now ↗</Text>
          </TouchableOpacity>
        )}
        {isFollowUp && (
          <TouchableOpacity style={styles.primaryBtn} onPress={handleSend}>
            <Text style={styles.primaryBtnText}>Resend ↗</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.snoozeBtn}
          onPress={() => handleSnooze(3)}>
          <Text style={styles.snoozeBtnText}>Snooze 3d</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.doneBtn} onPress={handleDone}>
          <Ionicons name="checkmark" size={16} color="#4A9E6B" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card:           { backgroundColor:"#fff", borderRadius:14, marginBottom:10,
                    overflow:"hidden", shadowColor:"#000",
                    shadowOpacity:0.06, shadowRadius:8 },
  header:         { flexDirection:"row", alignItems:"flex-start",
                    padding:14, justifyContent:"space-between" },
  headerLeft:     { flex:1 },
  typeTag:        { fontSize:11, fontWeight:"700", color:"#A0856B",
                    letterSpacing:0.5, marginBottom:4 },
  title:          { fontSize:15, fontWeight:"700", color:"#5C4033" },
  dueDate:        { fontSize:12, color:"#E84A4A", marginTop:3, fontWeight:"600" },
  preview:        { backgroundColor:"#FFF8F0", padding:14, gap:4,
                    borderTopWidth:1, borderTopColor:"#F5E6D3" },
  previewLabel:   { fontSize:11, fontWeight:"700", color:"#A0856B",
                    letterSpacing:0.5 },
  previewValue:   { fontSize:13, color:"#5C4033", marginBottom:6 },
  previewBody:    { fontSize:13, color:"#5C4033", lineHeight:18 },
  amount:         { fontSize:24, fontWeight:"800", color:"#E8734A" },
  payUrl:         { fontSize:11, color:"#A0856B", marginTop:4 },
  actions:        { flexDirection:"row", gap:8, padding:12, paddingTop:0,
                    alignItems:"center" },
  primaryBtn:     { flex:1, backgroundColor:"#E8734A", borderRadius:10,
                    paddingVertical:10, alignItems:"center" },
  primaryBtnText: { color:"#fff", fontWeight:"700", fontSize:14 },
  snoozeBtn:      { backgroundColor:"#F5E6D3", borderRadius:10,
                    paddingVertical:10, paddingHorizontal:12 },
  snoozeBtnText:  { color:"#8B4513", fontWeight:"600", fontSize:12 },
  doneBtn:        { backgroundColor:"#F0FFF4", borderRadius:10,
                    padding:10 },
});
