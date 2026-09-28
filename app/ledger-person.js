import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Linking,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { deletePayment, getPayments, updatePayment } from "../utils/storage";
import { cancelPaymentReminder } from "../utils/notifications";
import { getCategory } from "../utils/categories";
import {
  computeHistoryWithRunningBalance,
  computePersonBalance,
  getLedgerEntriesForPerson,
} from "../utils/ledger";
import { useTheme, withAlpha } from "../utils/theme";
import { LedgerFab } from "../components/LedgerFab";

// "Mon, 17 Aug 26 - 03:44 PM" - "en-US" ka default weekday+day+month+year
// order "Mon, Aug 17, 2026" deta hai, is liye pieces khud jorte hain taake
// din pehle, mahina baad, 2-digit saal wala format mile.
function formatDateTime(dateISO) {
  const d = new Date(dateISO);
  const weekday = d.toLocaleDateString("en-US", { weekday: "short" });
  const day = String(d.getDate()).padStart(2, "0");
  const month = d.toLocaleDateString("en-US", { month: "short" });
  const year = String(d.getFullYear()).slice(-2);
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  return `${weekday}, ${day} ${month} ${year} • ${time}`;
}

// Compact transaction row - purpose text ke bold hone se date/amount se
// pehle nazar aata hai, direction ek chhota color-coded badge/label hai.
function TransactionRow({ entry, styles, theme, onPress }) {
  const isBorrowed = entry.ledgerDirection === "borrowed";
  const directionColor = isBorrowed ? theme.danger : theme.primary;
  const purpose = entry.notes?.trim() ? entry.notes.trim() : "Transaction";
  const partiallySettled = !entry.isPaid && (entry.amountReceived ?? 0) > 0;

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.rowIconBadge, { backgroundColor: withAlpha(directionColor, theme.mode === "dark" ? 0.24 : 0.13) }]}>
        <Ionicons name={isBorrowed ? "arrow-down-circle" : "arrow-up-circle"} size={18} color={directionColor} />
      </View>
      <View style={styles.rowContent}>
        <Text style={styles.rowPurpose} numberOfLines={1}>
          {purpose}
        </Text>
        <Text style={styles.rowDate}>{formatDateTime(entry.dueDate)}</Text>
        {entry.isPaid ? (
          <Text style={styles.rowSettledTag}>Settled</Text>
        ) : partiallySettled ? (
          <Text style={styles.rowPartialNote}>${entry.amountReceived} already settled</Text>
        ) : null}
      </View>
      <View style={styles.rowAmountCol}>
        <Text style={[styles.rowAmount, { color: directionColor }]}>${entry.amount}</Text>
        <View style={[styles.rowDirectionPill, { backgroundColor: withAlpha(directionColor, theme.mode === "dark" ? 0.24 : 0.13) }]}>
          <Text style={[styles.rowDirectionText, { color: directionColor }]}>
            {isBorrowed ? "You Borrowed" : "You Lent"}
          </Text>
        </View>
        <Text style={[styles.rowBalance, { color: entry.runningBalance >= 0 ? theme.primary : theme.danger }]}>
          Balance: ${Math.abs(entry.runningBalance)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// Row tap karne par khulta hai - poori detail read-only dikhata hai, phir
// Edit (existing add-payment edit form reuse karta hai) ya Delete (confirm
// ke sath) offer karta hai. Koi partial-settle action yahan nahi hai.
function TransactionDetailModal({ entry, name, visible, onClose, onEdit, onDelete, styles, theme }) {
  if (!entry) return null;
  const isBorrowed = entry.ledgerDirection === "borrowed";
  const directionColor = isBorrowed ? theme.danger : theme.primary;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
          <View style={styles.modalHeaderRow}>
            <Text style={styles.modalTitle}>Transaction Detail</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalAmountRow}>
            <Text style={[styles.modalAmount, { color: directionColor }]}>${entry.amount}</Text>
            <View style={[styles.rowDirectionPill, { backgroundColor: withAlpha(directionColor, theme.mode === "dark" ? 0.24 : 0.13) }]}>
              <Text style={[styles.rowDirectionText, { color: directionColor }]}>
                {isBorrowed ? "You Borrowed" : "You Lent"}
              </Text>
            </View>
          </View>

          <View style={styles.modalDetailRow}>
            <Text style={styles.modalDetailLabel}>Contact</Text>
            <Text style={styles.modalDetailValue}>{name}</Text>
          </View>
          <View style={styles.modalDetailRow}>
            <Text style={styles.modalDetailLabel}>Purpose</Text>
            <Text style={styles.modalDetailValue}>{entry.notes?.trim() ? entry.notes.trim() : "Transaction"}</Text>
          </View>
          <View style={styles.modalDetailRow}>
            <Text style={styles.modalDetailLabel}>Date</Text>
            <Text style={styles.modalDetailValue}>{formatDateTime(entry.dueDate)}</Text>
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalEditButton} onPress={onEdit}>
              <Ionicons name="create-outline" size={16} color={theme.text} />
              <Text style={styles.modalEditButtonText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalDeleteButton, { borderColor: theme.danger }]} onPress={onDelete}>
              <Ionicons name="trash-outline" size={16} color={theme.danger} />
              <Text style={[styles.modalDeleteButtonText, { color: theme.danger }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// "Rename Contact" - naya naam poochta hai, phir is person ki SAARI entries
// ka title bulk-update karta hai (identity naam hi hai, dekhein utils/ledger.js).
function RenameModal({ visible, currentName, onClose, onSave, styles, theme }) {
  const [value, setValue] = useState(currentName);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onShow={() => setValue(currentName)}
    >
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
          <Text style={styles.modalTitle}>Rename Contact</Text>
          <TextInput
            style={styles.renameInput}
            value={value}
            onChangeText={setValue}
            autoFocus
            placeholder="Person's name"
            placeholderTextColor={theme.textMuted}
          />
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalEditButton} onPress={onClose}>
              <Text style={styles.modalEditButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalEditButton, { backgroundColor: getCategory("ledger").color }]}
              onPress={() => onSave(value)}
            >
              <Text style={[styles.modalEditButtonText, { color: "#fff" }]}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

export default function LedgerPersonScreen() {
  const { name } = useLocalSearchParams();
  const router = useRouter();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [renameVisible, setRenameVisible] = useState(false);
  const ledgerColor = getCategory("ledger").color;

  const refresh = useCallback(async () => {
    const data = await getPayments();
    setPayments(data);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      (async () => {
        const data = await getPayments();
        if (isActive) {
          setPayments(data);
          setLoading(false);
        }
      })();
      return () => {
        isActive = false;
      };
    }, [])
  );

  const entries = useMemo(() => getLedgerEntriesForPerson(payments, name ?? ""), [payments, name]);
  const balance = useMemo(() => computePersonBalance(entries), [entries]);
  const history = useMemo(() => computeHistoryWithRunningBalance(entries), [entries]);
  const phoneNumber = entries.find((e) => e.phoneNumber)?.phoneNumber;
  // Ek hi net figure dikhate hain (toReceive - toPay), do alag cards nahi -
  // jaise hi koi partial/opposite-direction transaction add hoti hai, yeh
  // khud-ba-khud dusre balance mein se minus ho jati hai (computePersonBalance
  // pehle se yehi karta hai, sirf display ab do totals ki jagah ek net hai).
  const netColor = balance.net === 0 ? theme.textMuted : balance.net > 0 ? theme.primary : theme.danger;
  const netLabel = balance.net === 0 ? "Settled" : balance.net > 0 ? "You'll Receive" : "You Owe";
  const netIcon = balance.net === 0 ? "checkmark-circle" : balance.net > 0 ? "arrow-down-circle" : "arrow-up-circle";

  const visibleHistory = useMemo(() => {
    if (!search.trim()) return history;
    const q = search.trim().toLowerCase();
    return history.filter((e) => {
      const purpose = (e.notes ?? "").toLowerCase();
      const amountText = String(e.amount);
      const dateText = formatDateTime(e.dueDate).toLowerCase();
      return purpose.includes(q) || amountText.includes(q) || dateText.includes(q);
    });
  }, [history, search]);

  async function handleDeleteEntry(entry) {
    Alert.alert("Delete this transaction?", `This will update the balance with ${name}.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await cancelPaymentReminder(entry.notificationId);
          await deletePayment(entry.id);
          setSelectedEntry(null);
          refresh();
        },
      },
    ]);
  }

  function handleEditEntry(entry) {
    setSelectedEntry(null);
    router.push({ pathname: "/add-payment", params: { id: entry.id } });
  }

  function confirmDeleteContact() {
    Alert.alert(
      "Delete contact?",
      `This will permanently delete all ${entries.length} transaction${entries.length === 1 ? "" : "s"} with ${name}. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await Promise.all(
              entries.map(async (e) => {
                await cancelPaymentReminder(e.notificationId);
                await deletePayment(e.id);
              })
            );
            router.back();
          },
        },
      ]
    );
  }

  async function handleRename(newName) {
    const trimmed = newName.trim();
    setRenameVisible(false);
    if (!trimmed || trimmed.toLowerCase() === (name ?? "").trim().toLowerCase()) return;
    await Promise.all(entries.map((e) => updatePayment(e.id, { title: trimmed })));
    router.setParams({ name: trimmed });
    refresh();
  }

  function openMenu() {
    Alert.alert(name, undefined, [
      { text: "Rename Contact", onPress: () => setRenameVisible(true) },
      { text: "Delete Contact", style: "destructive", onPress: confirmDeleteContact },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: name ?? "Ledger",
          headerBackTitle: "",
          headerRight: () => (
            <TouchableOpacity onPress={openMenu} hitSlop={8} style={{ marginRight: 8 }}>
              <Ionicons name="ellipsis-vertical" size={20} color={theme.text} />
            </TouchableOpacity>
          ),
        }}
      />

      <FlatList
        data={visibleHistory}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <Text style={styles.subtitle}>Ledger history</Text>
            {phoneNumber ? (
              <TouchableOpacity style={styles.callRow} onPress={() => Linking.openURL(`tel:${phoneNumber}`)}>
                <Ionicons name="call-outline" size={14} color={theme.primary} />
                <Text style={styles.callText}>{phoneNumber}</Text>
              </TouchableOpacity>
            ) : null}

            <View
              style={[
                styles.netCard,
                {
                  backgroundColor: withAlpha(netColor, theme.mode === "dark" ? 0.16 : 0.09),
                  borderColor: withAlpha(netColor, theme.mode === "dark" ? 0.3 : 0.16),
                },
              ]}
            >
              <View style={[styles.summaryIconBadge, { backgroundColor: withAlpha(netColor, theme.mode === "dark" ? 0.26 : 0.16) }]}>
                <Ionicons name={netIcon} size={20} color={netColor} />
              </View>
              <View style={styles.netCardText}>
                <Text style={styles.summaryLabel}>{netLabel}</Text>
                <Text style={[styles.netCardValue, { color: netColor }]}>${Math.abs(balance.net)}</Text>
              </View>
            </View>

            <View style={styles.searchRow}>
              <Ionicons name="search" size={16} color={theme.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search transactions..."
                placeholderTextColor={theme.textMuted}
                value={search}
                onChangeText={setSearch}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}>
                  <Ionicons name="close-circle" size={16} color={theme.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.sectionLabel}>Transaction History</Text>

            {!loading && history.length === 0 && (
              <View style={styles.emptyState}>
                <View style={[styles.emptyIconBadge, { backgroundColor: withAlpha(ledgerColor, theme.mode === "dark" ? 0.2 : 0.1) }]}>
                  <Ionicons name="receipt-outline" size={36} color={ledgerColor} />
                </View>
                <Text style={styles.emptyTitle}>No transactions yet</Text>
                <Text style={styles.emptySubtitle}>Start tracking money you lend or borrow with {name}.</Text>
              </View>
            )}

            {history.length > 0 && visibleHistory.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No transactions found</Text>
                <Text style={styles.emptySubtitle}>Try a different search.</Text>
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <TransactionRow entry={item} styles={styles} theme={theme} onPress={() => setSelectedEntry(item)} />
        )}
      />

      <LedgerFab
        onPress={() => router.push({ pathname: "/add-payment", params: { category: "ledger", title: name, phone: phoneNumber ?? "" } })}
      />

      <TransactionDetailModal
        entry={selectedEntry}
        name={name}
        visible={Boolean(selectedEntry)}
        onClose={() => setSelectedEntry(null)}
        onEdit={() => handleEditEntry(selectedEntry)}
        onDelete={() => handleDeleteEntry(selectedEntry)}
        styles={styles}
        theme={theme}
      />

      <RenameModal
        visible={renameVisible}
        currentName={name ?? ""}
        onClose={() => setRenameVisible(false)}
        onSave={handleRename}
        styles={styles}
        theme={theme}
      />
    </View>
  );
}

function getStyles(theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    list: {
      padding: 16,
      paddingBottom: 100,
    },
    subtitle: {
      fontSize: 13,
      color: theme.textSecondary,
      marginBottom: 8,
    },
    callRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 14,
    },
    callText: {
      fontSize: 13,
      color: theme.primary,
      fontWeight: "600",
    },
    netCard: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 18,
      borderWidth: 1,
      padding: 16,
      marginBottom: 16,
    },
    netCardText: {
      marginLeft: 12,
    },
    summaryIconBadge: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    summaryLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.textSecondary,
      marginBottom: 4,
    },
    netCardValue: {
      fontSize: 24,
      fontWeight: "700",
    },
    searchRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 24,
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: theme.surface,
      marginBottom: 18,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: theme.text,
      padding: 0,
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.textSecondary,
      marginBottom: 12,
      letterSpacing: 0.2,
    },
    row: {
      flexDirection: "row",
      alignItems: "flex-start",
      backgroundColor: theme.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 12,
      marginBottom: 10,
      shadowColor: theme.mode === "dark" ? "#000" : theme.brandPurple,
      shadowOpacity: theme.mode === "dark" ? 0.25 : 0.05,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    rowIconBadge: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 10,
    },
    rowContent: {
      flex: 1,
      marginRight: 8,
    },
    rowPurpose: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.text,
    },
    rowDate: {
      fontSize: 11,
      color: theme.textMuted,
      marginTop: 2,
    },
    rowSettledTag: {
      fontSize: 11,
      fontWeight: "600",
      color: theme.textMuted,
      marginTop: 4,
    },
    rowPartialNote: {
      fontSize: 11,
      color: theme.textMuted,
      fontStyle: "italic",
      marginTop: 4,
    },
    rowAmountCol: {
      alignItems: "flex-end",
    },
    rowAmount: {
      fontSize: 16,
      fontWeight: "700",
    },
    rowDirectionPill: {
      borderRadius: 10,
      paddingHorizontal: 8,
      paddingVertical: 2,
      marginTop: 4,
    },
    rowDirectionText: {
      fontSize: 10,
      fontWeight: "700",
    },
    rowBalance: {
      fontSize: 11,
      fontWeight: "600",
      marginTop: 4,
    },
    emptyState: {
      alignItems: "center",
      paddingVertical: 28,
    },
    emptyIconBadge: {
      width: 68,
      height: 68,
      borderRadius: 34,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 14,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.text,
      marginBottom: 6,
    },
    emptySubtitle: {
      fontSize: 13,
      color: theme.textSecondary,
      textAlign: "center",
      paddingHorizontal: 20,
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
      backgroundColor: theme.surface,
      borderRadius: 18,
      padding: 20,
    },
    modalHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 14,
    },
    modalTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.text,
    },
    modalAmountRow: {
      alignItems: "center",
      gap: 8,
      marginBottom: 18,
    },
    modalAmount: {
      fontSize: 28,
      fontWeight: "700",
    },
    modalDetailRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    modalDetailLabel: {
      fontSize: 13,
      color: theme.textSecondary,
    },
    modalDetailValue: {
      fontSize: 13,
      color: theme.text,
      fontWeight: "600",
      flexShrink: 1,
      textAlign: "right",
    },
    modalActions: {
      flexDirection: "row",
      gap: 10,
      marginTop: 18,
    },
    modalEditButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      borderRadius: 12,
      paddingVertical: 12,
      backgroundColor: theme.surfaceSoft,
    },
    modalEditButtonText: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.text,
    },
    modalDeleteButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      borderRadius: 12,
      paddingVertical: 12,
      borderWidth: 1,
    },
    modalDeleteButtonText: {
      fontSize: 14,
      fontWeight: "700",
    },
    renameInput: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      padding: 12,
      fontSize: 15,
      color: theme.text,
    },
  });
}
