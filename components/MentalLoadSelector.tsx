import { useState, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
} from "react-native";
import { API_BASE_URL } from "@/constants/config";

const AREAS = [
  { id: "school",    icon: "🏫", title: "School & activities",     sub: "Events, dismissals, recitals, field trips" },
  { id: "camps",     icon: "🏕️", title: "Camps & sign-ups",        sub: "Deadlines, forms, registration links" },
  { id: "medical",   icon: "🏥", title: "Medical & prescriptions",  sub: "Appointments, refills, follow-ups" },
  { id: "bills",     icon: "💳", title: "Bills & payments",         sub: "Due dates, invoices, renewals" },
  { id: "kids_apps", icon: "📱", title: "Kids apps",                sub: "Campanion, Seesaw, ClassDojo" },
];

export default function MentalLoadSelector({ user_id, onDone }: { user_id: string; onDone: () => void }) {
  const [selected, setSelected] = useState<string[]>(["school","camps","medical","bills","kids_apps"]);
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    if (!user_id) return;
    fetch(`${API_BASE_URL}/user/preferences?user_id=${user_id}`)
      .then(r => r.json())
      .then(d => { if (d.mental_load_areas) setSelected(d.mental_load_areas); })
      .catch(() => {});
  }, [user_id]);

  function toggle(id: string) {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      await fetch(`${API_BASE_URL}/user/preferences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id, mental_load_areas: selected }),
      });
      onDone();
    } catch { onDone(); }
    finally { setSaving(false); }
  }

  return (
    <View>
      {AREAS.map(area => {
        const isSelected = selected.includes(area.id);
        return (
          <TouchableOpacity
            key={area.id}
            style={[s.item, isSelected && s.itemSelected]}
            onPress={() => toggle(area.id)}>
            <View style={[s.check, isSelected && s.checkSelected]}>
              {isSelected && <Text style={s.checkMark}>✓</Text>}
            </View>
            <Text style={s.icon}>{area.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>{area.title}</Text>
              <Text style={s.sub}>{area.sub}</Text>
            </View>
          </TouchableOpacity>
        );
      })}

      <TouchableOpacity style={[s.btn, saving && { opacity: 0.6 }]}
        onPress={handleSave} disabled={saving}>
        {saving
          ? <ActivityIndicator color="#fff" />
          : <Text style={s.btnText}>Get started →</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={onDone} style={s.skip}>
        <Text style={s.skipText}>Skip for now</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  item:         { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#fff",
                  borderRadius: 10, padding: 10, marginBottom: 8, borderWidth: 1.5, borderColor: "#F5E6D3" },
  itemSelected: { borderColor: "#E8734A", backgroundColor: "#FFF0E8" },
  check:        { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: "#E8734A",
                  alignItems: "center", justifyContent: "center" },
  checkSelected:{ backgroundColor: "#E8734A" },
  checkMark:    { color: "#fff", fontSize: 11, fontWeight: "700" },
  icon:         { fontSize: 20 },
  title:        { fontSize: 13, fontWeight: "600", color: "#5C4033" },
  sub:          { fontSize: 11, color: "#A0856B", marginTop: 1 },
  btn:          { backgroundColor: "#E8734A", borderRadius: 12, paddingVertical: 12,
                  alignItems: "center", marginTop: 8, marginBottom: 4 },
  btnText:      { color: "#fff", fontWeight: "700", fontSize: 14 },
  skip:         { alignItems: "center", paddingVertical: 6 },
  skipText:     { color: "#A0856B", fontSize: 13 },
});
