import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../utils/firebase";
import { useAuth } from "../contexts/AuthContext";
import { CATEGORIES, getCategory } from "../utils/categories";
import { createSharedPayment, findUserByEmail } from "../utils/sharedPayments";
import { useTheme, withAlpha } from "../utils/theme";

// Total amount ko participants ke beech barabar baant deta hai - aakhri
// participant ko baqi bacha hua "rounding leftover" mil jata hai, taake
// total hamesha exactly original amount ke barabar rahe (cents drift na ho).
function splitEqually(participants, totalAmount) {
  if (participants.length === 0) return participants;
  const base = Math.floor((totalAmount / participants.length) * 100) / 100;
  return participants.map((p, i) => {
    if (i === participants.length - 1) {
      const othersTotal = base * (participants.length - 1);
      return { ...p, share: Math.round((totalAmount - othersTotal) * 100) / 100 };
    }
    return { ...p, share: base };
  });
}

export default function AddSharedBillScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("rent");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Khud ko hamesha pehla participant bana dete hain - 100% share tab tak
  // jab tak koi aur add na ho.
  useEffect(() => {
    if (!user) return;
    setParticipants([{ uid: user.uid, email: user.email, displayName: user.email, share: 0 }]);
    (async () => {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        const data = snap.data();
        // "(You)" suffix yahan nahi lagate - wo sirf apni khud ki screen par
        // dikhna chahiye. Naam plain store hota hai, taake doosre participant
        // ki screen par bhi ye sahi (bina "(You)") dikhe.
        const name = `${data.firstName ?? ""} ${data.lastName ?? ""}`.trim();
        if (name) {
          setParticipants((prev) =>
            prev.map((p) => (p.uid === user.uid ? { ...p, displayName: name } : p))
          );
        }
      }
    })();
  }, [user]);

  // Amount badalte hi shares ko dobara equally split kar dete hain - user
  // agar manually adjust kar chuka ho to yeh unko overwrite kar dega, isliye
  // sirf tab chalate hain jab amount khud badle (naya field, edit nahi).
  useEffect(() => {
    const total = Number(amount);
    if (!total || isNaN(total)) return;
    setParticipants((prev) => splitEqually(prev, total));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount]);

  function onChangeDate(event, selectedDate) {
    setShowPicker(Platform.OS === "ios");
    if (selectedDate) setDueDate(selectedDate);
  }

  async function handleInvite() {
    setInviteError("");
    if (!inviteEmail.trim()) return;
    const normalized = inviteEmail.trim().toLowerCase();

    if (participants.some((p) => p.email.toLowerCase() === normalized)) {
      setInviteError("This person is already added.");
      return;
    }

    setInviting(true);
    const found = await findUserByEmail(normalized);
    setInviting(false);

    if (!found) {
      setInviteError("No Reminds Me user found with this email. They need to sign up first.");
      return;
    }

    const name = `${found.firstName ?? ""} ${found.lastName ?? ""}`.trim() || found.email;
    const total = Number(amount) || 0;
    setParticipants((prev) => splitEqually([...prev, { uid: found.uid, email: found.email, displayName: name, share: 0 }], total));
    setInviteEmail("");
  }

  function handleRemoveParticipant(uid) {
    const total = Number(amount) || 0;
    setParticipants((prev) => splitEqually(prev.filter((p) => p.uid !== uid), total));
  }

  function handleShareChange(uid, text) {
    setParticipants((prev) => prev.map((p) => (p.uid === uid ? { ...p, share: text } : p)));
  }

  function handleSplitEqually() {
    const total = Number(amount) || 0;
    setParticipants((prev) => splitEqually(prev, total));
  }

  const shareTotal = participants.reduce((sum, p) => sum + (Number(p.share) || 0), 0);
  const totalAmount = Number(amount) || 0;
  const sharesMismatch = participants.length > 0 && Math.abs(shareTotal - totalAmount) > 0.01;

  async function handleSave() {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setError("Amount must be a valid number");
      return;
    }
    if (participants.length < 2) {
      setError("Add at least one more person to split this bill with");
      return;
    }
    if (sharesMismatch) {
      setError("Shares must add up to the total amount");
      return;
    }

    setSaving(true);
    try {
      await createSharedPayment({
        title: title.trim(),
        category,
        amount: Number(amount),
        dueDate: dueDate.toISOString(),
        isRecurring: true,
        participants: participants.map((p) => ({ ...p, share: Number(p.share) || 0 })),
      });
      router.back();
    } catch (e) {
      setError("Couldn't create shared bill. Please try again.");
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "Split a Bill", presentation: "modal" }} />

      <View
        style={[
          styles.card,
          {
            backgroundColor: withAlpha(
              getCategory(category).color,
              theme.mode === "dark" ? 0.14 : 0.06
            ),
          },
        ]}
      >
        <Text style={styles.cardTitle}>Category</Text>
        <View style={styles.categoryRow}>
          {CATEGORIES.map((c) => {
            const active = category === c.key;
            return (
              <TouchableOpacity
                key={c.key}
                style={[
                  styles.categoryChip,
                  active && { backgroundColor: c.color, borderColor: c.color },
                ]}
                onPress={() => setCategory(c.key)}
              >
                <Ionicons
                  name={c.icon}
                  size={16}
                  color={active ? "#fff" : c.color}
                  style={styles.categoryChipIcon}
                />
                <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Details</Text>

        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Apartment Rent"
          placeholderTextColor={theme.textMuted}
          value={title}
          onChangeText={setTitle}
        />

        <Text style={styles.label}>Total Amount ($)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 1200"
          placeholderTextColor={theme.textMuted}
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
        />

        <Text style={styles.label}>Due Date</Text>
        <TouchableOpacity style={styles.input} onPress={() => setShowPicker(true)}>
          <Text style={styles.dateText}>
            {dueDate.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" })}
          </Text>
        </TouchableOpacity>
        {showPicker && (
          <DateTimePicker value={dueDate} mode="date" display="default" onChange={onChangeDate} />
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.splitHeaderRow}>
          <Text style={styles.cardTitle}>Split With</Text>
          <TouchableOpacity onPress={handleSplitEqually}>
            <Text style={styles.splitEquallyLink}>Split Equally</Text>
          </TouchableOpacity>
        </View>

        {participants.map((p) => (
          <View key={p.uid} style={styles.participantRow}>
            <View style={styles.participantInfo}>
              <Text style={styles.participantName}>{p.displayName}</Text>
              <Text style={styles.participantEmail}>{p.email}</Text>
            </View>
            <Text style={styles.shareDollar}>$</Text>
            <TextInput
              style={styles.shareInput}
              keyboardType="numeric"
              value={String(p.share)}
              onChangeText={(text) => handleShareChange(p.uid, text)}
            />
            {p.uid !== user?.uid && (
              <TouchableOpacity onPress={() => handleRemoveParticipant(p.uid)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={20} color={theme.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        ))}

        {sharesMismatch && (
          <Text style={styles.mismatchText}>
            Shares total ${shareTotal.toFixed(2)}, but amount is ${totalAmount.toFixed(2)}.
          </Text>
        )}

        <Text style={styles.label}>Add Person by Email</Text>
        <View style={styles.inviteRow}>
          <TextInput
            style={[styles.input, styles.inviteInput]}
            placeholder="roommate@example.com"
            placeholderTextColor={theme.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={inviteEmail}
            onChangeText={setInviteEmail}
          />
          <TouchableOpacity style={styles.inviteButton} onPress={handleInvite} disabled={inviting}>
            <Text style={styles.inviteButtonText}>{inviting ? "..." : "Add"}</Text>
          </TouchableOpacity>
        </View>
        {inviteError ? <Text style={styles.error}>{inviteError}</Text> : null}
        <Text style={styles.hint}>
          They must already have a Reminds Me account with this email.
        </Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
        <Text style={styles.saveButtonText}>{saving ? "Creating..." : "Create Shared Bill"}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function getStyles(theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    content: { padding: 16, paddingBottom: 40 },
    card: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 18,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },
    cardTitle: {
      fontSize: 12,
      fontWeight: "700",
      color: theme.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 14,
    },
    label: {
      fontSize: 13,
      fontWeight: "600",
      marginBottom: 6,
      marginTop: 14,
      color: theme.text,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      padding: 12,
      fontSize: 15,
      color: theme.text,
    },
    dateText: { color: theme.text },
    categoryRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    categoryChip: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.border,
    },
    categoryChipIcon: { marginRight: 6 },
    categoryChipActive: { backgroundColor: theme.primary, borderColor: theme.primary },
    categoryChipText: { color: theme.text, fontSize: 13 },
    categoryChipTextActive: { color: "#fff" },
    splitHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 2,
    },
    splitEquallyLink: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.primary,
      marginBottom: 14,
    },
    participantRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      gap: 8,
    },
    participantInfo: { flex: 1 },
    participantName: { fontSize: 14, fontWeight: "600", color: theme.text },
    participantEmail: { fontSize: 12, color: theme.textSecondary, marginTop: 1 },
    shareDollar: { color: theme.textSecondary, fontSize: 14 },
    shareInput: {
      width: 64,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      padding: 8,
      fontSize: 14,
      color: theme.text,
      textAlign: "right",
    },
    mismatchText: {
      fontSize: 12,
      color: theme.danger,
      marginTop: 10,
    },
    inviteRow: {
      flexDirection: "row",
      gap: 8,
    },
    inviteInput: { flex: 1 },
    inviteButton: {
      backgroundColor: theme.primary,
      borderRadius: 10,
      paddingHorizontal: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    inviteButtonText: { color: "#fff", fontWeight: "700" },
    hint: {
      fontSize: 11,
      color: theme.textMuted,
      marginTop: 8,
    },
    error: {
      color: theme.danger,
      marginBottom: 12,
      textAlign: "center",
    },
    saveButton: {
      backgroundColor: theme.primary,
      borderRadius: 12,
      padding: 16,
      alignItems: "center",
      marginTop: 8,
    },
    saveButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  });
}
