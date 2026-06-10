import { useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  TextInput, Modal, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { API_BASE_URL } from "@/constants/config";

const STEPS = ["camps", "orientation", "logistics", "medical", "packing", "done"];

export default function CampSetupModal({
  user_id, kids, visible, onClose, onComplete
}: {
  user_id: string;
  kids: any[];
  visible: boolean;
  onClose: () => void;
  onComplete: () => void;
}) {
  const [kidIndex,   setKidIndex]   = useState(0);
  const [step,       setStep]       = useState(0);
  const [input,      setInput]      = useState("");
  const [loading,    setLoading]    = useState(false);
  const [savedCamps, setSavedCamps] = useState<any[]>([]);
  const [busNeeded,  setBusNeeded]  = useState<boolean|null>(null);
  const [mealsNeeded,setMealsNeeded]= useState<boolean|null>(null);
  const [packingList,setPackingList]= useState("");
  const [medInfo,    setMedInfo]    = useState<any>(null);

  const kid = kids[kidIndex];

  async function handleCamps() {
    if (!input.trim()) { nextKid(); return; }
    setLoading(true);
    try {
      const res  = await fetch(`${API_BASE_URL}/camps/parse`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id, child_name: kid.name, text: input.trim() }),
      });
      const data = await res.json();
      const camps = data.camps || [];
      const created = [];
      for (const camp of camps) {
        const r = await fetch(`${API_BASE_URL}/camps`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id, child_name: kid.name, ...camp }),
        });
        const d = await r.json();
        created.push({ ...camp, id: d.id });
      }
      setSavedCamps(created);
      setInput("");
      setStep(1);
    } catch { }
    finally { setLoading(false); }
  }

  async function handleOrientation() {
    if (input.trim() && savedCamps.length > 0) {
      for (const camp of savedCamps) {
        if (camp.id) {
          await fetch(`${API_BASE_URL}/camps/${camp.id}/status`, {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id, orientation_date: input.trim() }),
          }).catch(() => {});
        }
      }
    }
    setInput("");
    setStep(2);
  }

  async function handleLogistics() {
    if (savedCamps.length > 0) {
      for (const camp of savedCamps) {
        if (camp.id) {
          await fetch(`${API_BASE_URL}/camps/${camp.id}/status`, {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_id,
              bus_needed:   busNeeded   ? 1 : 0,
              meals_needed: mealsNeeded ? 1 : 0,
            }),
          }).catch(() => {});
        }
      }
    }
    // Check medical
    await checkMedical();
    setStep(3);
  }

  async function checkMedical() {
    try {
      const res  = await fetch(
        `${API_BASE_URL}/events?user_id=${user_id}&days_ahead=0`
      );
      const events = await res.json();
      const doctorEvents = Array.isArray(events)
        ? events.filter((e: any) =>
            e.event_type === "doctor_appointment" &&
            (e.child_name === kid.name || e.child_name === "all"))
        : [];
      if (doctorEvents.length > 0) {
        const lastDate = doctorEvents.sort((a: any, b: any) =>
          b.event_date.localeCompare(a.event_date))[0].event_date;
        const monthsAgo = Math.round(
          (Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24 * 30)
        );
        setMedInfo({ lastDate, monthsAgo, needsNew: monthsAgo > 11 });
      } else {
        setMedInfo({ lastDate: null, monthsAgo: null, needsNew: true });
      }
    } catch { setMedInfo(null); }
  }

  async function handlePacking() {
    if (packingList.trim() && savedCamps.length > 0) {
      for (const camp of savedCamps) {
        if (camp.id) {
          await fetch(`${API_BASE_URL}/camps/${camp.id}/status`, {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id, packing_list: packingList.trim() }),
          }).catch(() => {});
          // Generate checklist
          await fetch(
            `${API_BASE_URL}/camps/${camp.id}/checklist/generate?user_id=${user_id}`,
            { method: "POST" }
          ).catch(() => {});
        }
      }
    }
    setStep(5);
  }

  function nextKid() {
    if (kidIndex < kids.length - 1) {
      setKidIndex(kidIndex + 1);
      setStep(0);
      setInput("");
      setSavedCamps([]);
      setBusNeeded(null);
      setMealsNeeded(null);
      setPackingList("");
      setMedInfo(null);
    } else {
      setStep(5);
    }
  }

  function handleClose() {
    setKidIndex(0); setStep(0); setInput("");
    setSavedCamps([]); setBusNeeded(null);
    setMealsNeeded(null); setPackingList(""); setMedInfo(null);
    onClose();
  }

  const defaultPacking = savedCamps[0]?.camp_type === "overnight"
    ? "Bedding, toiletries, sunscreen x2, water bottle, clothes for each day, swimsuit x2"
    : savedCamps[0]?.camp_name?.toLowerCase().includes("code") ||
      savedCamps[0]?.camp_name?.toLowerCase().includes("wiz")
    ? "Laptop, charger, water bottle, lunch, sunscreen"
    : "Water bottle, sunscreen x2, lunch, comfortable clothes";

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <View style={s.overlay}>
        <View style={s.card}>
          <View style={s.handle} />

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Step indicators */}
            <View style={s.stepRow}>
              {STEPS.slice(0, -1).map((_, i) => (
                <View key={i} style={[s.stepDot,
                  i < step && s.stepDone,
                  i === step && s.stepActive]} />
              ))}
            </View>

            {step === 0 && (
              <View>
                <Text style={s.title}>🧒 {kid?.name}</Text>
                <Text style={s.body}>What camps is {kid?.name} doing? Include dates and deadlines if you know them.</Text>
                <TextInput style={s.input} multiline numberOfLines={4}
                  placeholder="e.g. Code Wiz July 14-18, deadline June 19. Camp Ramah June 28 - July 26..."
                  placeholderTextColor="#A0856B"
                  value={input} onChangeText={setInput} />
                <TouchableOpacity style={[s.btn, loading && { opacity: 0.6 }]}
                  disabled={loading} onPress={handleCamps}>
                  {loading ? <ActivityIndicator color="#fff" />
                    : <Text style={s.btnText}>{input.trim() ? "Save & continue →" : "Skip →"}</Text>}
                </TouchableOpacity>
              </View>
            )}

            {step === 1 && (
              <View>
                <Text style={s.title}>📅 Orientation</Text>
                <Text style={s.body}>
                  {savedCamps.length > 0
                    ? `When is orientation for ${savedCamps[0].camp_name}? (optional)`
                    : "Any orientation dates to add?"}
                </Text>
                <TextInput style={s.input}
                  placeholder="e.g. July 13 or July 13 at 9am"
                  placeholderTextColor="#A0856B"
                  value={input} onChangeText={setInput} />
                <TouchableOpacity style={s.btn} onPress={handleOrientation}>
                  <Text style={s.btnText}>{input.trim() ? "Save & continue →" : "Skip →"}</Text>
                </TouchableOpacity>
              </View>
            )}

            {step === 2 && (
              <View>
                <Text style={s.title}>🚌 Bus & meals</Text>
                <Text style={s.body}>Does {kid?.name} need bus or meal sign-up?</Text>

                <Text style={s.chipLabel}>Bus transportation</Text>
                <View style={s.chipRow}>
                  {["Yes", "No", "Not sure"].map(opt => (
                    <TouchableOpacity key={opt}
                      style={[s.chip,
                        busNeeded === (opt === "Yes") && opt !== "Not sure" && s.chipActive,
                        busNeeded === null && opt === "Not sure" && s.chipActive]}
                      onPress={() => setBusNeeded(opt === "Yes" ? true : opt === "No" ? false : null)}>
                      <Text style={[s.chipText,
                        (busNeeded === (opt === "Yes") && opt !== "Not sure") && s.chipTextActive]}>
                        {opt}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[s.chipLabel, { marginTop: 12 }]}>Meals</Text>
                <View style={s.chipRow}>
                  {["Yes", "No", "Not sure"].map(opt => (
                    <TouchableOpacity key={opt}
                      style={[s.chip,
                        mealsNeeded === (opt === "Yes") && opt !== "Not sure" && s.chipActive]}
                      onPress={() => setMealsNeeded(opt === "Yes" ? true : opt === "No" ? false : null)}>
                      <Text style={[s.chipText,
                        mealsNeeded === (opt === "Yes") && opt !== "Not sure" && s.chipTextActive]}>
                        {opt}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity style={[s.btn, { marginTop: 16 }]} onPress={handleLogistics}>
                  <Text style={s.btnText}>Continue →</Text>
                </TouchableOpacity>
              </View>
            )}

            {step === 3 && (
              <View>
                <Text style={s.title}>🏥 Medical forms</Text>
                {medInfo ? (
                  medInfo.needsNew ? (
                    <View style={s.warnCard}>
                      <Text style={s.warnTitle}>⚠️ Physical exam needed</Text>
                      <Text style={s.warnBody}>
                        {medInfo.lastDate
                          ? `${kid?.name}'s last doctor visit was ${medInfo.monthsAgo} months ago. Medical forms typically require a physical within 12 months.`
                          : `No recent doctor visit found for ${kid?.name}. You may need to schedule a physical before submitting medical forms.`}
                      </Text>
                    </View>
                  ) : (
                    <View style={s.okCard}>
                      <Text style={s.okTitle}>✓ Physical is current</Text>
                      <Text style={s.okBody}>Last visit was {medInfo.monthsAgo} months ago — within the 12-month window for medical forms.</Text>
                    </View>
                  )
                ) : (
                  <Text style={s.body}>Checking {kid?.name}'s medical history...</Text>
                )}
                <TouchableOpacity style={[s.btn, { marginTop: 16 }]} onPress={() => setStep(4)}>
                  <Text style={s.btnText}>Continue →</Text>
                </TouchableOpacity>
              </View>
            )}

            {step === 4 && (
              <View>
                <Text style={s.title}>🎒 Packing list</Text>
                <Text style={s.body}>What should {kid?.name} bring? Hearth will remind you 2 days before camp.</Text>
                <TextInput style={[s.input, { minHeight: 80 }]} multiline
                  placeholder={defaultPacking}
                  placeholderTextColor="#A0856B"
                  value={packingList}
                  onChangeText={setPackingList} />
                <TouchableOpacity style={s.btn} onPress={handlePacking}>
                  <Text style={s.btnText}>{packingList.trim() ? "Save & finish →" : "Use suggested →"}</Text>
                </TouchableOpacity>
              </View>
            )}

            {step === 5 && (
              <View>
                <Text style={s.title}>✅ All set!</Text>
                <Text style={s.body}>
                  {kidIndex < kids.length - 1
                    ? `Camps saved for ${kid?.name}. Ready to set up ${kids[kidIndex + 1]?.name}?`
                    : "All camps saved. Check the Actions tab to see deadlines and checklists."}
                </Text>
                {kidIndex < kids.length - 1 ? (
                  <TouchableOpacity style={s.btn} onPress={() => {
                    setKidIndex(kidIndex + 1);
                    setStep(0); setInput(""); setSavedCamps([]);
                    setBusNeeded(null); setMealsNeeded(null);
                    setPackingList(""); setMedInfo(null);
                  }}>
                    <Text style={s.btnText}>Next: {kids[kidIndex + 1]?.name} →</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={s.btn} onPress={() => { handleClose(); onComplete(); }}>
                    <Text style={s.btnText}>Done</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <TouchableOpacity onPress={handleClose} style={s.skip}>
              <Text style={s.skipText}>Close</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay:       { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  card:          { backgroundColor: "#FFF8F0", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, maxHeight: "90%" },
  handle:        { width: 36, height: 4, backgroundColor: "#C0C0C0", borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  stepRow:       { flexDirection: "row", gap: 6, justifyContent: "center", marginBottom: 16 },
  stepDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: "#F5E6D3" },
  stepDone:      { backgroundColor: "#4A9E6B" },
  stepActive:    { backgroundColor: "#E8734A", width: 20, borderRadius: 4 },
  title:         { fontSize: 20, fontWeight: "800", color: "#8B4513", marginBottom: 8 },
  body:          { fontSize: 14, color: "#5C4033", lineHeight: 20, marginBottom: 16 },
  input:         { borderWidth: 1, borderColor: "#E8E8E8", borderRadius: 12, padding: 12, fontSize: 14, color: "#333", backgroundColor: "#fff", textAlignVertical: "top", marginBottom: 16, minHeight: 60 },
  btn:           { backgroundColor: "#E8734A", borderRadius: 14, paddingVertical: 14, alignItems: "center", marginBottom: 8 },
  btnText:       { color: "#fff", fontWeight: "700", fontSize: 15 },
  skip:          { alignItems: "center", paddingVertical: 8 },
  skipText:      { color: "#A0856B", fontSize: 14 },
  chipLabel:     { fontSize: 13, fontWeight: "600", color: "#5C4033", marginBottom: 8 },
  chipRow:       { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip:          { borderWidth: 1, borderColor: "#E8E8E8", borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16, backgroundColor: "#fff" },
  chipActive:    { borderColor: "#E8734A", backgroundColor: "#FFF0E8" },
  chipText:      { fontSize: 13, color: "#5C4033" },
  chipTextActive:{ color: "#E8734A", fontWeight: "600" },
  warnCard:      { backgroundColor: "#FFF0E8", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#E8734A", marginBottom: 8 },
  warnTitle:     { fontSize: 14, fontWeight: "700", color: "#C0392B", marginBottom: 4 },
  warnBody:      { fontSize: 13, color: "#5C4033", lineHeight: 18 },
  okCard:        { backgroundColor: "#F0FFF4", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#4A9E6B", marginBottom: 8 },
  okTitle:       { fontSize: 14, fontWeight: "700", color: "#065F46", marginBottom: 4 },
  okBody:        { fontSize: 13, color: "#5C4033", lineHeight: 18 },
});
