import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { getPayments } from "../utils/storage";
import { recordLedgerPayment } from "../utils/paymentActions";
import { getCategory } from "../utils/categories";
import { getLedgerEntriesForPerson, computePersonBalance, remainingBalance } from "../utils/ledger";
import { useTheme, withAlpha } from "../utils/theme";

function formatDate(dateISO) {
  return new Date(dateISO).toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Ek transaction ka row - agar abhi settle nahi hui to "Mark as Received/Paid"
// (poora settle) aur "Record Partial Payment" (jitna mila utna daal do) dono
// options dete hain. Direction ke hisaab se label khud badal jata hai.
function TransactionRow({ entry, styles, theme, onSettle, onPartial }) {
  const [editing, setEditing] = useState(false);
  const [amountInput, setAmountInput] = useState("");
  const remaining = remainingBalance(entry);
  const isBorrowed = entry.ledgerDirection === "borrowed";
  const actionLabel = isBorrowed ? "Mark as Paid" : "Mark as Received";
  const directionColor = isBorrowed ? theme.danger : theme.primary;

  function handleSavePartial() {
    const value = Number(amountInput);
    if (!amountInput || isNaN(value) || value <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid amount greater than 0.");
      return;
    }
    onPartial(entry, Math.min(value, remaining));
    setAmountInput("");
    setEditing(false);
  }

  return (
    <View style={styles.transactionRow}>
      <View style={styles.transactionTopRow}>
        <View style={styles.transactionBadge}>
          <Ionicons
            name={isBorrowed ? "arrow-down-circle" : "arrow-up-circle"}
            size={16}
            color={directionColor}
          />
          <Text style={[styles.transactionDirection, { color: directionColor }]}>
            {isBorrowed ? "You Borrowed" : "You Lent"}
          </Text>
        </View>
        <Text style={styles.transactionDate}>{formatDate(entry.dueDate)}</Text>
      </View>

      <View style={styles.transactionAmountRow}>
        <Text style={styles.transactionAmount}>${entry.amount}</Text>
        {!entry.isPaid && (entry.amountReceived ?? 0) > 0 && (
          <Text style={styles.transactionProgress}>
            ${entry.amountReceived} settled - ${remaining} left
          </Text>
        )}
      </View>

      {entry.isPaid ? (
        <View style={[styles.settledTag, { backgroundColor: directionColor }]}>
          <Ionicons name="checkmark-circle" size={14} color="#fff" />
          <Text style={styles.settledTagText}>{isBorrowed ? "Paid" : "Received"}</Text>
        </View>
      ) : editing ? (
        <View style={styles.partialRow}>
          <TextInput
            style={styles.partialInput}
            placeholder={`Up to $${remaining}`}
            placeholderTextColor={theme.textMuted}
            keyboardType="numeric"
            value={amountInput}
            onChangeText={setAmountInput}
            autoFocus
          />
          <TouchableOpacity style={styles.partialSaveButton} onPress={handleSavePartial}>
            <Text style={styles.partialSaveButtonText}>Save</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setEditing(false)} hitSlop={8}>
            <Ionicons name="close" size={20} color={theme.textMuted} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.transactionActions}>
          <TouchableOpacity
            style={[styles.actionButtonPrimary, { backgroundColor: directionColor }]}
            onPress={() => onSettle(entry)}
          >
            <Text style={styles.actionButtonPrimaryText}>{actionLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButtonSecondary} onPress={() => setEditing(true)}>
            <Text style={[styles.actionButtonSecondaryText, { color: directionColor }]}>
              Record Partial Payment
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// Ek person ke naam se link saari Ledger entries yahan mil jati hain - net
// balance, poori history, aur har entry par poora ya partial settle karne ka
// option. Payments tab ke Ledger cards yahin le aate hain (dekhein utils/ledger.js).
export default function LedgerPersonScreen() {
  const { name } = useLocalSearchParams();
  const router = useRouter();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const [payments, setPayments] = useState([]);

  const refresh = useCallback(async () => {
    const data = await getPayments();
    setPayments(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      (async () => {
        const data = await getPayments();
        if (isActive) setPayments(data);
      })();
      return () => {
        isActive = false;
      };
    }, [])
  );

  const entries = useMemo(() => getLedgerEntriesForPerson(payments, name ?? ""), [payments, name]);
  const balance = useMemo(() => computePersonBalance(entries), [entries]);
  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate)),
    [entries]
  );
  const phoneNumber = entries.find((e) => e.phoneNumber)?.phoneNumber;
  const ledgerColor = getCategory("ledger").color;

  async function handleFullSettle(entry) {
    await recordLedgerPayment(entry, remainingBalance(entry));
    refresh();
  }

  async function handlePartialSettle(entry, amount) {
    await recordLedgerPayment(entry, amount);
    refresh();
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: name ?? "Ledger" }} />

      <View
        style={[
          styles.headerCard,
          { backgroundColor: withAlpha(ledgerColor, theme.mode === "dark" ? 0.18 : 0.08) },
        ]}
      >
        <View
          style={[
            styles.avatar,
            { backgroundColor: withAlpha(ledgerColor, theme.mode === "dark" ? 0.28 : 0.16) },
          ]}
        >
          <Ionicons name="person-circle-outline" size={36} color={ledgerColor} />
        </View>
        <Text style={styles.personName}>{name}</Text>
        {phoneNumber ? (
          <TouchableOpacity style={styles.callRow} onPress={() => Linking.openURL(`tel:${phoneNumber}`)}>
            <Ionicons name="call-outline" size={14} color={theme.primary} />
            <Text style={styles.callText}>{phoneNumber}</Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.balanceRow}>
          <View style={styles.balanceCol}>
            <Text style={styles.balanceLabel}>You'll Receive</Text>
            <Text style={[styles.balanceValue, { color: theme.primary }]}>${balance.toReceive}</Text>
          </View>
          <View style={styles.balanceDivider} />
          <View style={styles.balanceCol}>
            <Text style={styles.balanceLabel}>You Owe</Text>
            <Text style={[styles.balanceValue, { color: theme.danger }]}>${balance.toPay}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionLabel}>History</Text>
      {sortedEntries.map((entry) => (
        <TransactionRow
          key={entry.id}
          entry={entry}
          styles={styles}
          theme={theme}
          onSettle={handleFullSettle}
          onPartial={handlePartialSettle}
        />
      ))}

      <TouchableOpacity
        style={styles.addButton}
        onPress={() =>
          router.push({ pathname: "/add-payment", params: { category: "ledger", title: name } })
        }
      >
        <Ionicons name="add" size={18} color={ledgerColor} />
        <Text style={[styles.addButtonText, { color: ledgerColor }]}>Add Another Payment</Text>
      </TouchableOpacity>
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
    headerCard: {
      borderRadius: 16,
      padding: 20,
      alignItems: "center",
      marginBottom: 20,
    },
    avatar: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 10,
    },
    personName: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.text,
    },
    callRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 6,
    },
    callText: {
      fontSize: 13,
      color: theme.primary,
      fontWeight: "600",
    },
    balanceRow: {
      flexDirection: "row",
      width: "100%",
      marginTop: 18,
    },
    balanceCol: {
      flex: 1,
      alignItems: "center",
    },
    balanceDivider: {
      width: 1,
      backgroundColor: theme.border,
    },
    balanceLabel: {
      fontSize: 12,
      color: theme.textSecondary,
      marginBottom: 4,
    },
    balanceValue: {
      fontSize: 20,
      fontWeight: "700",
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.textSecondary,
      marginBottom: 12,
    },
    transactionRow: {
      backgroundColor: theme.surface,
      borderRadius: 14,
      padding: 14,
      marginBottom: 12,
    },
    transactionTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    transactionBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    transactionDirection: {
      fontSize: 13,
      fontWeight: "700",
    },
    transactionDate: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    transactionAmountRow: {
      marginTop: 8,
    },
    transactionAmount: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.text,
    },
    transactionProgress: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
    settledTag: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: 4,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 5,
      marginTop: 10,
    },
    settledTagText: {
      color: "#fff",
      fontSize: 12,
      fontWeight: "700",
    },
    transactionActions: {
      flexDirection: "row",
      gap: 10,
      marginTop: 12,
    },
    actionButtonPrimary: {
      flex: 1,
      borderRadius: 10,
      paddingVertical: 10,
      alignItems: "center",
    },
    actionButtonPrimaryText: {
      color: "#fff",
      fontSize: 13,
      fontWeight: "700",
    },
    actionButtonSecondary: {
      flex: 1,
      borderRadius: 10,
      paddingVertical: 10,
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.border,
    },
    actionButtonSecondaryText: {
      fontSize: 13,
      fontWeight: "600",
    },
    partialRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: 12,
    },
    partialInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      padding: 10,
      fontSize: 14,
      color: theme.text,
    },
    partialSaveButton: {
      backgroundColor: theme.primary,
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    partialSaveButtonText: {
      color: "#fff",
      fontSize: 13,
      fontWeight: "700",
    },
    addButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      borderWidth: 1.5,
      borderColor: theme.border,
      borderRadius: 12,
      paddingVertical: 14,
      marginTop: 8,
    },
    addButtonText: {
      fontSize: 14,
      fontWeight: "700",
    },
  });
}
