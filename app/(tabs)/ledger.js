import { useCallback, useMemo, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  LayoutAnimation,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { getPayments } from "../../utils/storage";
import { computeLedgerTotals, groupLedgerContacts } from "../../utils/ledger";
import { getCategory } from "../../utils/categories";
import { useTheme, withAlpha } from "../../utils/theme";
import { AdBanner } from "../../components/AdBanner";
import { LedgerFab } from "../../components/LedgerFab";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const FILTERS = [
  { key: "all", label: "All" },
  { key: "owe", label: "You Owe" },
  { key: "owed", label: "They Owe" },
];

function formatDate(dateISO) {
  return new Date(dateISO).toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// "John Smith" -> "JS", ek lafz wale naam ke liye pehle 2 letters.
function getInitials(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function ContactCard({ contact, styles, theme, onPress }) {
  const { net } = contact.balance;
  const isSettled = net === 0;
  const isOwed = net > 0;
  const statusColor = isSettled ? theme.textMuted : isOwed ? theme.primary : theme.danger;
  const statusLabel = isSettled ? "Settled" : isOwed ? "You'll Receive" : "You Owe";
  const ledgerColor = getCategory("ledger").color;

  return (
    <TouchableOpacity style={styles.contactCard} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.avatar, { backgroundColor: withAlpha(ledgerColor, theme.mode === "dark" ? 0.26 : 0.14) }]}>
        <Text style={[styles.avatarText, { color: ledgerColor }]}>{getInitials(contact.name)}</Text>
      </View>
      <View style={styles.contactInfo}>
        <Text style={styles.contactName} numberOfLines={1}>
          {contact.name}
        </Text>
        <Text style={styles.contactMeta}>Last transaction: {formatDate(contact.lastTransactionDate)}</Text>
      </View>
      <View style={styles.contactBalanceCol}>
        <Text style={[styles.contactAmount, { color: statusColor }]}>
          ${isSettled ? 0 : Math.abs(net)}
        </Text>
        <Text style={[styles.contactStatus, { color: statusColor }]}>{statusLabel}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.textMuted} style={styles.chevron} />
    </TouchableOpacity>
  );
}

export default function LedgerScreen() {
  const router = useRouter();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      (async () => {
        const data = await getPayments();
        if (isActive) {
          setPayments(data);
          setLoading(false);
          Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
        }
      })();
      return () => {
        isActive = false;
      };
    }, [])
  );

  const totals = useMemo(() => computeLedgerTotals(payments), [payments]);
  const net = totals.totalToReceive - totals.totalToPay;
  const contacts = useMemo(() => groupLedgerContacts(payments), [payments]);

  const visibleContacts = useMemo(() => {
    let list = contacts;
    if (filter === "owe") list = list.filter((c) => c.balance.net < 0);
    else if (filter === "owed") list = list.filter((c) => c.balance.net > 0);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (c) => c.name.toLowerCase().includes(q) || (c.phoneNumber && c.phoneNumber.includes(q))
      );
    }
    return [...list].sort((a, b) => new Date(b.lastTransactionDate) - new Date(a.lastTransactionDate));
  }, [contacts, filter, search]);

  // Ad banner ko list ke andar hi ek "card slot" ki tarah dikhate hain - 2nd
  // contact card ke baad 3rd slot pe (2 se kam cards hon to sabse aakhir mein).
  const visibleContactsWithAd = useMemo(() => {
    if (visibleContacts.length === 0) return visibleContacts;
    const withAd = [...visibleContacts];
    withAd.splice(Math.min(2, visibleContacts.length), 0, { name: "__ad_banner__", isAdSlot: true });
    return withAd;
  }, [visibleContacts]);

  function changeFilter(key) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setFilter(key);
  }

  const hasActiveFilter = Boolean(filter !== "all" || search.trim());

  if (!loading && contacts.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <View style={[styles.emptyIconBadge, { backgroundColor: withAlpha(getCategory("ledger").color, theme.mode === "dark" ? 0.2 : 0.1) }]}>
            <Ionicons name="swap-horizontal-outline" size={40} color={getCategory("ledger").color} />
          </View>
          <Text style={styles.emptyTitle}>Your Ledger is empty</Text>
          <Text style={styles.emptySubtitle}>
            Track money you owe or money others owe you.
          </Text>
          <Link href={{ pathname: "/add-payment", params: { category: "ledger" } }} asChild>
            <TouchableOpacity style={styles.emptyCta}>
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.emptyCtaText}>Add Transaction</Text>
            </TouchableOpacity>
          </Link>
          <AdBanner />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={visibleContactsWithAd}
        keyExtractor={(item) => item.name}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <Text style={styles.subtitle}>Track money you owe and money owed to you</Text>

            <Animated.View style={{ opacity: fadeAnim }}>
              <LinearGradient
                colors={[withAlpha(theme.gradientStart, theme.mode === "dark" ? 0.24 : 0.15), withAlpha(theme.gradientEnd, theme.mode === "dark" ? 0.24 : 0.15)]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.summaryCard}
              >
                <View style={styles.summaryRow}>
                  <View style={styles.summaryCol}>
                    <View style={[styles.summaryIconBadge, { backgroundColor: withAlpha(theme.brandCoral, theme.mode === "dark" ? 0.28 : 0.16) }]}>
                      <Ionicons name="arrow-up-circle" size={18} color={theme.danger} />
                    </View>
                    <Text style={styles.summaryLabel}>You Owe</Text>
                    <Text style={[styles.summaryValue, { color: theme.danger }]}>${totals.totalToPay}</Text>
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryCol}>
                    <View style={[styles.summaryIconBadge, { backgroundColor: withAlpha(theme.primary, theme.mode === "dark" ? 0.28 : 0.16) }]}>
                      <Ionicons name="arrow-down-circle" size={18} color={theme.primary} />
                    </View>
                    <Text style={styles.summaryLabel}>You'll Receive</Text>
                    <Text style={[styles.summaryValue, { color: theme.primary }]}>${totals.totalToReceive}</Text>
                  </View>
                </View>

                <View style={styles.netRow}>
                  <Text style={styles.netLabel}>Net Balance</Text>
                  <Text
                    style={[
                      styles.netValue,
                      { color: net === 0 ? theme.textSecondary : net > 0 ? theme.primary : theme.danger },
                    ]}
                  >
                    {net === 0 ? "Balanced" : `${net > 0 ? "+" : "-"}$${Math.abs(net)}`}
                  </Text>
                </View>
              </LinearGradient>
            </Animated.View>

            <View style={styles.filterRow}>
              {FILTERS.map((f) => (
                <TouchableOpacity
                  key={f.key}
                  style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
                  onPress={() => changeFilter(f.key)}
                >
                  <Text style={[styles.filterChipText, filter === f.key && styles.filterChipTextActive]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.searchRow}>
              <Ionicons name="search" size={16} color={theme.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search people..."
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

            {visibleContacts.length === 0 && (
              <View style={styles.noMatchState}>
                <Text style={styles.emptyTitle}>No matching contacts</Text>
                <Text style={styles.emptySubtitle}>
                  {hasActiveFilter
                    ? "Try a different search term or filter."
                    : "Add a transaction to get started."}
                </Text>
              </View>
            )}
          </View>
        }
        renderItem={({ item }) =>
          item.isAdSlot ? (
            <AdBanner />
          ) : (
            <ContactCard
              contact={item}
              styles={styles}
              theme={theme}
              onPress={() => router.push({ pathname: "/ledger-person", params: { name: item.name } })}
            />
          )
        }
      />

      <LedgerFab onPress={() => router.push({ pathname: "/add-payment", params: { category: "ledger" } })} />
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
      marginBottom: 14,
    },
    summaryCard: {
      borderRadius: 20,
      padding: 18,
    },
    summaryRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    summaryCol: {
      flex: 1,
      alignItems: "center",
    },
    summaryDivider: {
      width: 1,
      height: 48,
      backgroundColor: withAlpha(theme.text, 0.1),
    },
    summaryIconBadge: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 8,
    },
    summaryLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.textSecondary,
      marginBottom: 4,
    },
    summaryValue: {
      fontSize: 20,
      fontWeight: "700",
    },
    netRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 18,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: withAlpha(theme.text, 0.08),
    },
    netLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.textSecondary,
    },
    netValue: {
      fontSize: 16,
      fontWeight: "700",
    },
    filterRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: 18,
      marginBottom: 12,
    },
    filterChip: {
      flex: 1,
      paddingVertical: 9,
      alignItems: "center",
      borderRadius: 20,
      backgroundColor: theme.surfaceSoft,
    },
    filterChipActive: {
      backgroundColor: withAlpha(getCategory("ledger").color, theme.mode === "dark" ? 0.32 : 0.16),
    },
    filterChipText: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.textSecondary,
    },
    filterChipTextActive: {
      color: getCategory("ledger").color,
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
      marginBottom: 16,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: theme.text,
      padding: 0,
    },
    noMatchState: {
      alignItems: "center",
      paddingVertical: 32,
    },
    contactCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
      marginBottom: 10,
      shadowColor: theme.mode === "dark" ? "#000" : theme.brandPurple,
      shadowOpacity: theme.mode === "dark" ? 0.25 : 0.05,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    avatarText: {
      fontSize: 15,
      fontWeight: "700",
    },
    contactInfo: {
      flex: 1,
      marginRight: 8,
    },
    contactName: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.text,
    },
    contactMeta: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
    contactBalanceCol: {
      alignItems: "flex-end",
    },
    contactAmount: {
      fontSize: 15,
      fontWeight: "700",
    },
    contactStatus: {
      fontSize: 11,
      fontWeight: "600",
      marginTop: 2,
    },
    chevron: {
      marginLeft: 6,
    },
    emptyState: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    },
    emptyIconBadge: {
      width: 80,
      height: 80,
      borderRadius: 40,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.text,
      marginBottom: 6,
    },
    emptySubtitle: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: "center",
    },
    emptyCta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: getCategory("ledger").color,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 20,
      marginTop: 20,
    },
    emptyCtaText: {
      color: "#fff",
      fontSize: 14,
      fontWeight: "700",
    },
  });
}
