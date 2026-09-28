import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { addPayment, deletePayment, getPayments, updatePayment } from "../utils/storage";
import { cancelPaymentReminder, schedulePaymentReminder, scheduleLedgerReminder } from "../utils/notifications";
import { CATEGORIES } from "../utils/categories";
import { PROVIDERS } from "../utils/providers";
import { getProviderLink } from "../utils/providerLinks";
import { guessCategory } from "../utils/categoryGuess";
import { useTheme, withAlpha } from "../utils/theme";
import { getCategory } from "../utils/categories";

const REMINDER_OPTIONS = [
  { label: "On due date", value: 0 },
  { label: "1 day before", value: 1 },
  { label: "3 days before", value: 3 },
  { label: "1 week before", value: 7 },
];

const LEDGER_DIRECTIONS = [
  { label: "You Lent", value: "lent" },
  { label: "You Borrowed", value: "borrowed" },
];

function ProviderModal({ visible, providers, onSelect, onClose, theme, styles }) {
  const [search, setSearch] = useState("");

  // Modal dobara khulne par pichli search saaf kar dete hain, taake alag
  // category ke providers dekhte waqt purana search text na reh jaye.
  useEffect(() => {
    if (visible) setSearch("");
  }, [visible]);

  const filteredProviders = providers.filter((p) =>
    p.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Provider</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={styles.modalSearchRow}>
            <Ionicons name="search" size={16} color={theme.textMuted} />
            <TextInput
              style={styles.modalSearchInput}
              placeholder="Search providers..."
              placeholderTextColor={theme.textMuted}
              value={search}
              onChangeText={setSearch}
              autoFocus
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")}>
                <Ionicons name="close-circle" size={16} color={theme.textMuted} />
              </TouchableOpacity>
            )}
          </View>
          <ScrollView style={styles.modalList}>
            {filteredProviders.length === 0 ? (
              <Text style={styles.modalEmptyText}>No providers match "{search}"</Text>
            ) : (
              filteredProviders.map((p) => (
                <TouchableOpacity key={p} style={styles.modalItem} onPress={() => onSelect(p)}>
                  <Text style={styles.modalItemText}>{p}</Text>
                  <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// Ledger ke liye reminder ki apni date+time - transaction ki date se bilkul
// alag rakhi hai (kuch log same-day transaction karte hain lekin reminder
// kisi aur din chahte hain, jaise "har mahine ki 1 tareekh"). Do jagah use
// hoti hai (naya contact add + existing contact mein naya transaction), dono
// "Set Reminder" on hone par yehi dikhate hain.
function LedgerReminderFields({
  reminderDate,
  onOpenDatePicker,
  onOpenTimePicker,
  reminderDaysBefore,
  setReminderDaysBefore,
  isRecurring,
  setIsRecurring,
  styles,
  theme,
}) {
  return (
    <>
      <Text style={styles.label}>Reminder Date</Text>
      <TouchableOpacity style={styles.input} onPress={onOpenDatePicker}>
        <Text style={styles.dateText}>
          {reminderDate.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" })}
        </Text>
      </TouchableOpacity>

      <Text style={styles.label}>Reminder Time</Text>
      <TouchableOpacity style={styles.input} onPress={onOpenTimePicker}>
        <Text style={styles.dateText}>
          {reminderDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
        </Text>
      </TouchableOpacity>

      <Text style={styles.label}>Remind Me</Text>
      <View style={styles.categoryRow}>
        {REMINDER_OPTIONS.map((r) => (
          <TouchableOpacity
            key={r.value}
            style={[styles.categoryChip, reminderDaysBefore === r.value && styles.categoryChipActive]}
            onPress={() => setReminderDaysBefore(r.value)}
          >
            <Text
              style={[styles.categoryChipText, reminderDaysBefore === r.value && styles.categoryChipTextActive]}
            >
              {r.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.toggleRow}>
        <View style={styles.toggleTextGroup}>
          <Text style={styles.label}>Repeat Monthly</Text>
          <Text style={styles.toggleSubtext}>
            {isRecurring
              ? "You'll be reminded every month on this day and time."
              : "One-time reminder on this date and time."}
          </Text>
        </View>
        <Switch value={isRecurring} onValueChange={setIsRecurring} trackColor={{ true: theme.primary }} />
      </View>
    </>
  );
}

// "Remind Me" chips + "Repeat Monthly" toggle - sirf bills ke liye (hamesha
// visible, due date se relative). Ledger ka apna alag LedgerReminderFields hai.
function RemindMeFields({ reminderDaysBefore, setReminderDaysBefore, isRecurring, setIsRecurring, styles, theme }) {
  return (
    <>
      <Text style={styles.label}>Remind Me</Text>
      <View style={styles.categoryRow}>
        {REMINDER_OPTIONS.map((r) => (
          <TouchableOpacity
            key={r.value}
            style={[styles.categoryChip, reminderDaysBefore === r.value && styles.categoryChipActive]}
            onPress={() => setReminderDaysBefore(r.value)}
          >
            <Text
              style={[styles.categoryChipText, reminderDaysBefore === r.value && styles.categoryChipTextActive]}
            >
              {r.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.toggleRow}>
        <View style={styles.toggleTextGroup}>
          <Text style={styles.label}>Repeat Monthly</Text>
          <Text style={styles.toggleSubtext}>
            {isRecurring ? "You'll be reminded every month." : "One-time reminder for this month only."}
          </Text>
        </View>
        <Switch value={isRecurring} onValueChange={setIsRecurring} trackColor={{ true: theme.primary }} />
      </View>
    </>
  );
}

export default function AddPaymentScreen() {
  const router = useRouter();
  const { id, category: categoryParam, title: titleParam, phone: phoneParam } = useLocalSearchParams();
  const isEditing = Boolean(id);
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);

  // Ledger contact detail screen se naam (aur maloom ho to phone) pehle se
  // bhar kar aati hai, taake dobara type na karna pade.
  const [title, setTitle] = useState(titleParam || "");
  // Ledger tab ke "+" se category=ledger route param ke saath yahan aate hain -
  // taake seedha Ledger category pehle se selected mile.
  const [category, setCategory] = useState(categoryParam || "rent");
  // Ledger contact detail screen se (naam pehle se maloom) ya kisi existing
  // ledger transaction ko edit karte waqt - dono cases mein person already
  // fix hai, is liye Name/Phone dobara nahi poochte aur reminder opt-in hota
  // hai (default off) instead of hamesha visible.
  const isKnownLedgerContact = category === "ledger" && (isEditing || Boolean(titleParam));
  const isLedger = category === "ledger";
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  // Sirf Ledger transactions ke liye - baaki payments ke liye din hi kaafi
  // hai, waqt kabhi UI mein nahi dikhaya jata (bills ke flow ko touch nahi karna).
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [reminderDaysBefore, setReminderDaysBefore] = useState(0);
  // Default OFF - naya payment sirf isi mahine ka one-time reminder hota hai
  // jab tak user khud "Repeat Monthly" on na kare. Edit mode mein neeche wale
  // useEffect se existing payment ki asal value load ho jati hai.
  const [isRecurring, setIsRecurring] = useState(false);
  // Sirf Ledger ke liye (naya contact ho ya existing) - "Set Reminder" toggle
  // default OFF, taake simple transaction add karte waqt notification
  // permission/scheduling ka jhanjhat na ho jab tak user khud na chahe.
  // Bills mein reminder pehle jesa hamesha "on" behave karta hai.
  const [setReminderOn, setSetReminderOn] = useState(false);
  // Reminder ki apni date+time - transaction ki "dueDate" se bilkul alag,
  // taake user same-day transaction karke bhi kisi aur din/waqt reminder
  // choose kar sake (jaise "har mahine ki 1 tareekh"). Default current
  // date+time, jaise dueDate bhi shuru mein hota hai.
  const [reminderDate, setReminderDate] = useState(new Date());
  const [showReminderDatePicker, setShowReminderDatePicker] = useState(false);
  const [showReminderTimePicker, setShowReminderTimePicker] = useState(false);
  // Provider select karne par khud-ba-khud bhar jate hain - koi manual input nahi.
  const [appScheme, setAppScheme] = useState("");
  const [appWebUrl, setAppWebUrl] = useState("");
  // Optional - agar diya ho to Payment Details screen par "N payments left"
  // payoff countdown dikhti hai.
  const [loanTermMonths, setLoanTermMonths] = useState("");
  // Sirf "Ledger" category ke liye - kisi ko paisa diya (lent) ya kisi se
  // liya (borrowed), aur unka phone number (optional).
  const [phoneNumber, setPhoneNumber] = useState(phoneParam || "");
  const [ledgerDirection, setLedgerDirection] = useState("lent");
  // Reference/note - Ledger transactions ke liye ("Borrowed for groceries" jaisa
  // chhota context), "notes" field storage mein pehle se maujood hai (baaki
  // categories abhi use nahi karti, is liye UI sirf Ledger ke liye dikhati hai).
  const [note, setNote] = useState("");
  // Ledger ke liye existing contacts ki naam list - taake same person ke liye
  // dobara typo-prone naam type na karna pade (duplicate contact na bane).
  const [ledgerContacts, setLedgerContacts] = useState([]);
  const [error, setError] = useState("");
  const [existingNotificationId, setExistingNotificationId] = useState(null);
  const [providerModalVisible, setProviderModalVisible] = useState(false);
  // Title type karte hi agar koi jaana-pehchana provider/keyword match ho
  // jaye (jaise "Geico") aur wo current category se alag ho, to yahan uski
  // category key aa jati hai - ek chhota suggestion banner dikhane ke liye.
  const [suggestedCategory, setSuggestedCategory] = useState(null);

  const providers = PROVIDERS[category] ?? [];

  useEffect(() => {
    // Ledger ke "title" ek person ka naam hai, bill-provider guess yahan
    // kabhi lagu nahi hoti - warna kisi naam ka koi provider keyword se
    // coincidentally match hone par category switch karne ka ajeeb suggestion aa sakta tha.
    if (category === "ledger") {
      setSuggestedCategory(null);
      return;
    }
    const guess = guessCategory(title);
    setSuggestedCategory(guess && guess !== category ? guess : null);
  }, [title, category]);

  function acceptSuggestedCategory() {
    setCategory(suggestedCategory);
    setSuggestedCategory(null);
  }

  // Edit mode mein hum existing payment ka data dhoondh kar form mein bhar dete hain.
  useEffect(() => {
    if (!isEditing) return;
    (async () => {
      const payments = await getPayments();
      const payment = payments.find((p) => p.id === id);
      if (payment) {
        setTitle(payment.title);
        setCategory(payment.category);
        setAmount(String(payment.amount));
        setDueDate(new Date(payment.dueDate));
        setReminderDaysBefore(payment.reminderDaysBefore ?? 0);
        // Purane records mein yeh field na ho to woh hamesha recurring maane
        // jate the (app ka original default) - is liye edit mode mein wahi
        // purana default preserve karte hain, sirf naye payments OFF se shuru hote hain.
        setIsRecurring(payment.isRecurring ?? true);
        setAppScheme(payment.appScheme ?? "");
        setAppWebUrl(payment.appWebUrl ?? "");
        setLoanTermMonths(payment.loanTermMonths ? String(payment.loanTermMonths) : "");
        setPhoneNumber(payment.phoneNumber ?? "");
        setLedgerDirection(payment.ledgerDirection ?? "lent");
        setNote(payment.notes ?? "");
        // Purane records mein "reminderDate" na ho (is feature se pehle ki
        // entries) to due date ko hi reasonable fallback maante hain.
        setReminderDate(payment.reminderDate ? new Date(payment.reminderDate) : new Date(payment.dueDate));
        setExistingNotificationId(payment.notificationId);
        // Agar is transaction ka pehle se koi reminder scheduled tha, toggle
        // ko "on" dikhate hain - warna user ko lagega reminder gayab ho gaya.
        setSetReminderOn(Boolean(payment.notificationId));
      }
    })();
  }, [id]);

  // Naya Ledger transaction add karte waqt existing contacts fetch karte hain
  // (edit mode mein zaroorat nahi) - taake neeche suggestion chips mein dikha
  // sakein aur user galti se ek hi banda do naamon se register na kar de.
  useEffect(() => {
    if (isEditing || category !== "ledger") return;
    (async () => {
      const payments = await getPayments();
      const names = new Map();
      payments
        .filter((p) => p.category === "ledger")
        .forEach((p) => {
          const key = p.title.trim().toLowerCase();
          if (!names.has(key)) {
            names.set(key, { name: p.title.trim(), phoneNumber: p.phoneNumber ?? "" });
          } else if (p.phoneNumber && !names.get(key).phoneNumber) {
            names.get(key).phoneNumber = p.phoneNumber;
          }
        });
      setLedgerContacts(Array.from(names.values()));
    })();
  }, [category, isEditing]);

  const matchingContacts = useMemo(() => {
    if (category !== "ledger" || !title.trim()) return [];
    const q = title.trim().toLowerCase();
    return ledgerContacts.filter(
      (c) => c.name.toLowerCase().includes(q) && c.name.toLowerCase() !== q
    );
  }, [ledgerContacts, title, category]);

  function selectExistingContact(contact) {
    setTitle(contact.name);
    if (contact.phoneNumber) setPhoneNumber(contact.phoneNumber);
  }

  function onChangeDate(event, selectedDate) {
    // Android par picker khud band ho jata hai, iOS par hum manually band karte hain.
    setShowPicker(Platform.OS === "ios");
    if (selectedDate) {
      // Purana time (hours/minutes) preserve karte hain - sirf din badalna hai.
      const merged = new Date(dueDate);
      merged.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      setDueDate(merged);
    }
  }

  // Android par "datetime" mode native support nahi karta (sirf iOS) - is
  // liye Date aur Time do alag pickers hain, dono usi "dueDate" Date object
  // ke apne hisse (din / waqt) update karte hain.
  function onChangeTime(event, selectedTime) {
    setShowTimePicker(Platform.OS === "ios");
    if (selectedTime) {
      const merged = new Date(dueDate);
      merged.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
      setDueDate(merged);
    }
  }

  // Reminder ki apni date+time - "reminderDate" state, "dueDate" se bilkul
  // alag rakhte hain (isi liye alag merge functions bhi).
  function onChangeReminderDate(event, selectedDate) {
    setShowReminderDatePicker(Platform.OS === "ios");
    if (selectedDate) {
      const merged = new Date(reminderDate);
      merged.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      setReminderDate(merged);
    }
  }

  function onChangeReminderTime(event, selectedTime) {
    setShowReminderTimePicker(Platform.OS === "ios");
    if (selectedTime) {
      const merged = new Date(reminderDate);
      merged.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
      setReminderDate(merged);
    }
  }

  function handleSelectProvider(provider) {
    setTitle(provider);
    // Provider select karte hi uska app-open link (agar maloom ho) khud set
    // ho jata hai - baad mein title edit karne se yeh nahi badalta.
    const link = getProviderLink(provider);
    setAppScheme(link?.appScheme ?? "");
    setAppWebUrl(link?.webUrl ?? "");
    setProviderModalVisible(false);
  }

  async function handleSave() {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (!amount || isNaN(Number(amount))) {
      setError("Amount must be a valid number");
      return;
    }
    if (loanTermMonths.trim() && (!Number.isInteger(Number(loanTermMonths)) || Number(loanTermMonths) <= 0)) {
      setError("Loan term must be a whole number of months");
      return;
    }

    const fields = {
      title: title.trim(),
      category,
      amount: Number(amount),
      dueDate: dueDate.toISOString(),
      reminderDaysBefore,
      isRecurring,
      appScheme,
      appWebUrl,
      loanTermMonths: loanTermMonths.trim() ? Number(loanTermMonths) : null,
      phoneNumber: category === "ledger" ? phoneNumber.trim() : "",
      ledgerDirection: category === "ledger" ? ledgerDirection : null,
      notes: category === "ledger" ? note.trim() : "",
      reminderDate: isLedger ? reminderDate.toISOString() : null,
    };

    // Ledger mein reminder sirf tab schedule hota hai jab user khud
    // "Set Reminder" on kare - bills mein pehle jesa hamesha schedule hota hai.
    const shouldSchedule = !isLedger || setReminderOn;
    // Ledger apni alag "reminderDate" (transaction ki dueDate se independent)
    // use karta hai, bills due-date-relative logic use karte hain.
    const scheduleFn = isLedger ? scheduleLedgerReminder : schedulePaymentReminder;

    if (isEditing) {
      // Purana reminder cancel karke naya schedule karte hain, kyunke due date badal sakti hai.
      await cancelPaymentReminder(existingNotificationId);
      const notificationId = shouldSchedule ? await scheduleFn({ id, ...fields }) : null;
      await updatePayment(id, { ...fields, notificationId });
    } else {
      const newPayment = await addPayment(fields);
      const notificationId = shouldSchedule ? await scheduleFn(newPayment) : null;
      if (notificationId) {
        await updatePayment(newPayment.id, { notificationId });
      }
    }

    router.back();
  }

  function handleDelete() {
    Alert.alert("Delete payment?", "This reminder will be permanently removed.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await cancelPaymentReminder(existingNotificationId);
          await deletePayment(id);
          router.back();
        },
      },
    ]);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen
        options={{
          title: isEditing
            ? category === "ledger"
              ? "Edit Transaction"
              : "Edit Payment"
            : category === "ledger"
            ? "Add Transaction"
            : "Add Payment",
        }}
      />

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
        {category === "ledger" ? (
          // Ledger apni alag flow hai (Ledger tab ke "+" se aati hai) - yahan
          // baaki categories dikhane ka koi matlab nahi, bas ek chhota header.
          <View style={styles.ledgerHeaderRow}>
            <Ionicons name={getCategory("ledger").icon} size={20} color={getCategory("ledger").color} />
            <Text style={[styles.ledgerHeaderText, { color: getCategory("ledger").color }]}>LEDGER</Text>
          </View>
        ) : (
          <>
            <Text style={styles.cardTitle}>Category</Text>
            <View style={styles.categoryRow}>
              {CATEGORIES.filter((c) => c.key !== "ledger").map((c) => {
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
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Details</Text>

        {isKnownLedgerContact ? (
          <View style={styles.forRow}>
            <Ionicons name="person-circle-outline" size={18} color={getCategory("ledger").color} />
            <Text style={styles.forRowText}>
              For <Text style={styles.forRowName}>{title}</Text>
            </Text>
          </View>
        ) : (
          <>
            {providers.length > 0 && (
              <>
                <Text style={styles.label}>Provider</Text>
                <TouchableOpacity
                  style={styles.dropdownButton}
                  onPress={() => setProviderModalVisible(true)}
                >
                  <Text style={styles.dropdownButtonText}>
                    {providers.includes(title) ? title : "Select Provider"}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color={theme.textSecondary} />
                </TouchableOpacity>
              </>
            )}

            <Text style={styles.label}>{category === "ledger" ? "Person's Name" : "Title"}</Text>
            <TextInput
              style={styles.input}
              placeholder={category === "ledger" ? "e.g. John Smith" : "e.g. House Rent"}
              placeholderTextColor={theme.textMuted}
              value={title}
              onChangeText={setTitle}
            />

            {matchingContacts.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.contactSuggestRow}>
                {matchingContacts.map((c) => (
                  <TouchableOpacity
                    key={c.name}
                    style={styles.contactSuggestChip}
                    onPress={() => selectExistingContact(c)}
                  >
                    <Ionicons name="person" size={12} color={getCategory("ledger").color} />
                    <Text style={styles.contactSuggestText}>{c.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </>
        )}

        {category === "ledger" && (
          <>
            <Text style={styles.label}>Lent or Borrowed?</Text>
            <View style={styles.categoryRow}>
              {LEDGER_DIRECTIONS.map((d) => (
                <TouchableOpacity
                  key={d.value}
                  style={[
                    styles.categoryChip,
                    ledgerDirection === d.value && styles.categoryChipActive,
                  ]}
                  onPress={() => setLedgerDirection(d.value)}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      ledgerDirection === d.value && styles.categoryChipTextActive,
                    ]}
                  >
                    {d.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {!isKnownLedgerContact && (
              <>
                <Text style={styles.label}>Phone Number (optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. +1 234 567 8900"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="phone-pad"
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                />
              </>
            )}

            <Text style={styles.label}>Reference / Note (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Borrowed for groceries"
              placeholderTextColor={theme.textMuted}
              value={note}
              onChangeText={setNote}
            />
          </>
        )}

        {suggestedCategory && (
          <TouchableOpacity
            style={[
              styles.suggestionBanner,
              { backgroundColor: withAlpha(getCategory(suggestedCategory).color, theme.mode === "dark" ? 0.2 : 0.1) },
            ]}
            onPress={acceptSuggestedCategory}
          >
            <Ionicons
              name={getCategory(suggestedCategory).icon}
              size={16}
              color={getCategory(suggestedCategory).color}
            />
            <Text style={[styles.suggestionText, { color: theme.text }]}>
              Looks like <Text style={{ fontWeight: "700" }}>{getCategory(suggestedCategory).label}</Text> - tap to switch
            </Text>
          </TouchableOpacity>
        )}

        <Text style={styles.label}>Amount ($)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 250"
          placeholderTextColor={theme.textMuted}
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
        />

        <Text style={styles.label}>{isKnownLedgerContact ? "Date" : "Due Date"}</Text>
        <TouchableOpacity style={styles.input} onPress={() => setShowPicker(true)}>
          <Text style={styles.dateText}>
            {dueDate.toLocaleDateString("en-US", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </Text>
        </TouchableOpacity>
        {showPicker && (
          <DateTimePicker
            value={dueDate}
            mode="date"
            display="default"
            onChange={onChangeDate}
          />
        )}

        {category === "ledger" && (
          <>
            <Text style={styles.label}>Time</Text>
            <TouchableOpacity style={styles.input} onPress={() => setShowTimePicker(true)}>
              <Text style={styles.dateText}>
                {dueDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
              </Text>
            </TouchableOpacity>
            {showTimePicker && (
              <DateTimePicker
                value={dueDate}
                mode="time"
                display="default"
                onChange={onChangeTime}
              />
            )}
          </>
        )}

        {isLedger ? (
          <>
            <View style={styles.toggleRow}>
              <View style={styles.toggleTextGroup}>
                <Text style={styles.label}>Set Reminder</Text>
                <Text style={styles.toggleSubtext}>
                  {setReminderOn
                    ? "You'll get a notification for this."
                    : "No reminder will be scheduled - just the transaction."}
                </Text>
              </View>
              <Switch
                value={setReminderOn}
                onValueChange={setSetReminderOn}
                trackColor={{ true: theme.primary }}
              />
            </View>

            {setReminderOn && (
              <>
                <LedgerReminderFields
                  reminderDate={reminderDate}
                  onOpenDatePicker={() => setShowReminderDatePicker(true)}
                  onOpenTimePicker={() => setShowReminderTimePicker(true)}
                  reminderDaysBefore={reminderDaysBefore}
                  setReminderDaysBefore={setReminderDaysBefore}
                  isRecurring={isRecurring}
                  setIsRecurring={setIsRecurring}
                  styles={styles}
                  theme={theme}
                />
                {showReminderDatePicker && (
                  <DateTimePicker
                    value={reminderDate}
                    mode="date"
                    display="default"
                    onChange={onChangeReminderDate}
                  />
                )}
                {showReminderTimePicker && (
                  <DateTimePicker
                    value={reminderDate}
                    mode="time"
                    display="default"
                    onChange={onChangeReminderTime}
                  />
                )}
              </>
            )}
          </>
        ) : (
          <RemindMeFields
            reminderDaysBefore={reminderDaysBefore}
            setReminderDaysBefore={setReminderDaysBefore}
            isRecurring={isRecurring}
            setIsRecurring={setIsRecurring}
            styles={styles}
            theme={theme}
          />
        )}

        {category !== "ledger" && (
          <>
            <Text style={styles.label}>Loan Term in Months (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 36 - shows a payoff countdown"
              placeholderTextColor={theme.textMuted}
              keyboardType="numeric"
              value={loanTermMonths}
              onChangeText={setLoanTermMonths}
            />
          </>
        )}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Save</Text>
      </TouchableOpacity>

      {isEditing && (
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Text style={styles.deleteButtonText}>Delete Payment</Text>
        </TouchableOpacity>
      )}

      <ProviderModal
        visible={providerModalVisible}
        providers={providers}
        onSelect={handleSelectProvider}
        onClose={() => setProviderModalVisible(false)}
        theme={theme}
        styles={styles}
      />
    </ScrollView>
  );
}

function getStyles(theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    content: {
      padding: 16,
      paddingBottom: 40,
    },
    card: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 18,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: "#000",
      shadowOpacity: theme.mode === "dark" ? 0.3 : 0.06,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 3,
    },
    ledgerHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    ledgerHeaderText: {
      fontSize: 14,
      fontWeight: "800",
      letterSpacing: 1,
    },
    forRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: withAlpha(getCategory("ledger").color, theme.mode === "dark" ? 0.16 : 0.08),
      borderRadius: 10,
      padding: 12,
    },
    forRowText: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    forRowName: {
      fontWeight: "700",
      color: theme.text,
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
    dateText: {
      color: theme.text,
    },
    toggleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 16,
    },
    toggleTextGroup: {
      flex: 1,
      marginRight: 12,
    },
    toggleSubtext: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
    suggestionBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderRadius: 10,
      padding: 10,
      marginTop: 8,
    },
    suggestionText: {
      fontSize: 12,
      flex: 1,
    },
    contactSuggestRow: {
      marginTop: 8,
    },
    contactSuggestChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 16,
      backgroundColor: withAlpha(getCategory("ledger").color, theme.mode === "dark" ? 0.2 : 0.1),
      marginRight: 8,
    },
    contactSuggestText: {
      fontSize: 12,
      fontWeight: "600",
      color: getCategory("ledger").color,
    },
    dropdownButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      padding: 12,
      backgroundColor: theme.primarySoft,
    },
    dropdownButtonText: {
      fontSize: 15,
      color: theme.text,
      fontWeight: "500",
    },
    categoryRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    categoryChip: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.border,
    },
    categoryChipIcon: {
      marginRight: 6,
    },
    categoryChipActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    categoryChipText: {
      color: theme.text,
      fontSize: 13,
    },
    categoryChipTextActive: {
      color: "#fff",
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
    saveButtonText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "700",
    },
    deleteButton: {
      borderRadius: 12,
      padding: 16,
      alignItems: "center",
      marginTop: 12,
      borderWidth: 1,
      borderColor: theme.danger,
    },
    deleteButtonText: {
      color: theme.danger,
      fontSize: 16,
      fontWeight: "600",
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.4)",
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    modalCard: {
      width: "100%",
      maxWidth: 420,
      maxHeight: "70%",
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 18,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    modalTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.text,
    },
    modalSearchRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginBottom: 10,
    },
    modalSearchInput: {
      flex: 1,
      fontSize: 15,
      color: theme.text,
      padding: 0,
    },
    modalEmptyText: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: "center",
      paddingVertical: 24,
    },
    modalList: {
      maxHeight: 360,
    },
    modalItem: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    modalItemText: {
      fontSize: 15,
      color: theme.text,
    },
  });
}
