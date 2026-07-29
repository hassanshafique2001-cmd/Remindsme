import { useEffect, useMemo, useState } from "react";
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { getCategory } from "../../utils/categories";
import { deleteSharedPayment, markMySharePaid, subscribeToMySharedPayments } from "../../utils/sharedPayments";
import { useTheme, withAlpha } from "../../utils/theme";
import { AdBanner } from "../../components/AdBanner";

function formatDate(dateISO) {
  return new Date(dateISO).toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function SharedBillCard({ bill, myUid, styles, theme }) {
  const category = getCategory(bill.category);
  const participants = Object.entries(bill.participants ?? {});
  const myEntry = bill.participants?.[myUid];
  const isOwner = bill.createdBy === myUid;

  function handleMarkPaid() {
    markMySharePaid(bill.id, myUid).catch(() => {
      Alert.alert("Couldn't Update", "Please check your connection and try again.");
    });
  }

  function handleDelete() {
    Alert.alert("Delete shared bill?", "This will remove it for everyone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteSharedPayment(bill.id) },
    ]);
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardMain}>
        <View
          style={[
            styles.iconBadge,
            { backgroundColor: withAlpha(category.color, theme.mode === "dark" ? 0.22 : 0.14) },
          ]}
        >
          <Ionicons name={category.icon} size={20} color={category.color} />
        </View>
        <View style={styles.cardContent}>
          <View style={styles.cardRow}>
            <Text style={styles.cardTitle}>{bill.title}</Text>
            <Text style={styles.cardAmount}>${bill.amount}</Text>
          </View>
          <Text style={styles.cardDue}>Due: {formatDate(bill.dueDate)}</Text>
        </View>
        {isOwner && (
          <TouchableOpacity onPress={handleDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="trash-outline" size={18} color={theme.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.participantList}>
        {participants.map(([uid, p]) => (
          <View key={uid} style={styles.participantRow}>
            <Ionicons
              name={p.hasPaid ? "checkmark-circle" : "ellipse-outline"}
              size={16}
              color={p.hasPaid ? theme.primary : theme.textMuted}
            />
            <Text style={styles.participantName}>
              {p.displayName}
              {uid === myUid ? " (You)" : ""}
            </Text>
            <Text style={styles.participantShare}>${p.share}</Text>
          </View>
        ))}
      </View>

      {myEntry && !myEntry.hasPaid && (
        <TouchableOpacity
          style={[styles.payButton, { backgroundColor: category.color }]}
          onPress={handleMarkPaid}
        >
          <Text style={styles.payButtonText}>Mark My Share as Paid (${myEntry.share})</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function SharedBillsScreen() {
  const { user } = useAuth();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const [bills, setBills] = useState([]);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToMySharedPayments(user.uid, setBills);
    return unsubscribe;
  }, [user]);

  // Ad banner ko list ke andar hi ek "card slot" ki tarah dikhate hain -
  // 3rd card ke baad 4th slot pe (3 se kam cards hon to sabse aakhir mein).
  const billsWithAd = useMemo(() => {
    if (bills.length === 0) return bills;
    const withAd = [...bills];
    withAd.splice(Math.min(3, bills.length), 0, { id: "__ad_banner__", isAdSlot: true });
    return withAd;
  }, [bills]);

  if (!user) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="people-outline" size={56} color={theme.textMuted} />
        <Text style={styles.emptyTitle}>Sign in to use Shared Bills</Text>
        <Text style={styles.emptySubtitle}>
          Splitting a bill needs a cloud account on both sides - sign in from the Profile tab first.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {bills.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={56} color={theme.textMuted} />
          <Text style={styles.emptyTitle}>No shared bills yet</Text>
          <Text style={styles.emptySubtitle}>
            Split a bill with a roommate or partner - they'll need a Reminds Me account too.
          </Text>
          <AdBanner />
          <AdBanner />
        </View>
      ) : (
        <FlatList
          data={billsWithAd}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) =>
            item.isAdSlot ? (
              <AdBanner />
            ) : (
              <SharedBillCard bill={item} myUid={user.uid} styles={styles} theme={theme} />
            )
          }
          contentContainerStyle={styles.list}
        />
      )}

      <Link href="/add-shared-bill" asChild>
        <TouchableOpacity style={styles.fab}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      </Link>
    </View>
  );
}

function getStyles(theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    list: { padding: 16 },
    emptyState: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      backgroundColor: theme.background,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: "600",
      marginTop: 12,
      marginBottom: 8,
      color: theme.text,
    },
    emptySubtitle: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: "center",
    },
    card: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      shadowColor: "#000",
      shadowOpacity: theme.mode === "dark" ? 0.3 : 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    cardMain: {
      flexDirection: "row",
      alignItems: "flex-start",
    },
    iconBadge: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.primarySoft,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    cardContent: { flex: 1 },
    cardRow: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.text,
    },
    cardAmount: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.primary,
    },
    cardDue: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 2,
    },
    participantList: {
      marginTop: 14,
      gap: 8,
    },
    participantRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    participantName: {
      flex: 1,
      fontSize: 13,
      color: theme.text,
    },
    participantShare: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.textSecondary,
    },
    payButton: {
      backgroundColor: theme.primary,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: "center",
      marginTop: 14,
    },
    payButtonText: {
      color: "#fff",
      fontSize: 14,
      fontWeight: "700",
    },
    fab: {
      position: "absolute",
      right: 20,
      bottom: 30,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
      elevation: 4,
      shadowColor: "#000",
      shadowOpacity: 0.2,
      shadowRadius: 4,
    },
    fabText: {
      color: "#fff",
      fontSize: 28,
      lineHeight: 30,
    },
  });
}
