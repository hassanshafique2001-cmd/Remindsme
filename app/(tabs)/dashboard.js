import { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { getPayments } from "../../utils/storage";
import { CATEGORIES, getCategory } from "../../utils/categories";
import { useTheme, withAlpha } from "../../utils/theme";
import { computeDisciplineScore } from "../../utils/streak";
import { computeLedgerTotals, getPaymentDetailRoute } from "../../utils/ledger";
import { AdBanner } from "../../components/AdBanner";

function formatDate(dateISO) {
  return new Date(dateISO).toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Payments se dashboard ke liye zaroori numbers nikalta hai - koi naya storage
// field nahi chahiye, jo data pehle se hai usi se hisaab lagta hai. "Ledger"
// (lend/borrow) entries yahan shamil nahi karte - unka apna alag "Lending"
// section hai (dekhein computeLedgerTotals), taake personal udhaar normal
// bills/expenses ke total mein mix na ho.
function computeStats(payments) {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();

  let dueThisMonth = 0;
  let paidThisMonth = 0;
  let upcomingTotal = 0;
  const categoryTotals = {};
  let nextPayment = null;

  payments.filter((p) => p.category !== "ledger").forEach((p) => {
    const isOutstanding = p.isRecurring || !p.isPaid;

    if (isOutstanding) {
      upcomingTotal += p.amount;
      categoryTotals[p.category] = (categoryTotals[p.category] ?? 0) + p.amount;

      const due = new Date(p.dueDate);
      if (due.getMonth() === month && due.getFullYear() === year) {
        dueThisMonth += p.amount;
      }
      if (!nextPayment || due < new Date(nextPayment.dueDate)) {
        nextPayment = p;
      }
    }

    if (p.paidDate) {
      const paidAt = new Date(p.paidDate);
      if (paidAt.getMonth() === month && paidAt.getFullYear() === year) {
        paidThisMonth += p.amount;
      }
    }
  });

  const categoryBreakdown = Object.entries(categoryTotals)
    .map(([category, amount]) => ({
      category,
      amount,
      percent: upcomingTotal > 0 ? (amount / upcomingTotal) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  return { dueThisMonth, paidThisMonth, upcomingTotal, categoryBreakdown, nextPayment };
}

// Pichle 6 mahino mein har category mein kitna paid hua - "paidHistory" (aur
// non-recurring ki paidDate) se banta hai. Har history entry ke liye payment
// ki CURRENT amount use karte hain (purani amount kahin store nahi hoti,
// jesa streak/payoff bhi karte hain), isliye price-change hone par purane
// mahinon ki value bhi naye amount se dikhegi - yeh app ka existing tradeoff hai.
function computeMonthlyCategoryTrend(payments) {
  const now = new Date();
  const buckets = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      year: d.getFullYear(),
      month: d.getMonth(),
      label: d.toLocaleDateString("en-US", { month: "short" }),
      categoryTotals: {},
      total: 0,
    });
  }

  function addEntry(dateISO, category, amount) {
    const d = new Date(dateISO);
    const bucket = buckets.find((b) => b.year === d.getFullYear() && b.month === d.getMonth());
    if (!bucket || !amount) return;
    bucket.categoryTotals[category] = (bucket.categoryTotals[category] ?? 0) + amount;
    bucket.total += amount;
  }

  payments.filter((p) => p.category !== "ledger").forEach((p) => {
    (p.paidHistory ?? []).forEach((raw) => {
      const paidDate = typeof raw === "string" ? raw : raw.paidDate;
      if (paidDate) addEntry(paidDate, p.category, p.amount);
    });
    if (!p.isRecurring && p.isPaid && p.paidDate) {
      addEntry(p.paidDate, p.category, p.amount);
    }
  });

  const maxTotal = Math.max(1, ...buckets.map((b) => b.total));
  return { buckets, maxTotal };
}

// Due date guzar chuki ho aur abhi tak paid na hui ho - recurring payments ke
// liye isPaid flag stale ho sakti hai (pichle cycle ki), is liye sirf due
// date ka guzarna hi kaafi hai; non-recurring ke liye isPaid bhi check karte hain.
function computeOverdueCount(payments) {
  const now = Date.now();
  return payments.filter((p) => {
    if (p.category === "ledger") return false;
    const isPastDue = new Date(p.dueDate).getTime() < now;
    if (!isPastDue) return false;
    return p.isRecurring || !p.isPaid;
  }).length;
}

// Har month ek vertical stacked bar - category ke hisaab se rangeen segments,
// height us mahine ke total ka 6-mahino ke max ke against proportion hai.
function SpendingTrendsChart({ trend, styles, theme }) {
  const { buckets, maxTotal } = trend;
  const hasData = buckets.some((b) => b.total > 0);
  if (!hasData) return null;

  const usedCategories = new Set();
  buckets.forEach((b) => Object.keys(b.categoryTotals).forEach((c) => usedCategories.add(c)));

  return (
    <>
      <Text style={styles.sectionLabel}>Spending Trends (Last 6 Months)</Text>
      <View style={styles.trendChartCard}>
        <View style={styles.trendBarsRow}>
          {buckets.map((b) => {
            const heightPercent = b.total > 0 ? Math.max((b.total / maxTotal) * 100, 4) : 0;
            const segments = Object.entries(b.categoryTotals).sort((a, c) => c[1] - a[1]);
            return (
              <View key={`${b.year}-${b.month}`} style={styles.trendBarColumn}>
                <View style={styles.trendBarTrack}>
                  <View style={[styles.trendBarStack, { height: `${heightPercent}%` }]}>
                    {segments.map(([cat, amt]) => (
                      <View key={cat} style={{ flex: amt, backgroundColor: getCategory(cat).color }} />
                    ))}
                  </View>
                </View>
                <Text style={styles.trendBarLabel}>{b.label}</Text>
              </View>
            );
          })}
        </View>
        <View style={styles.trendLegendRow}>
          {CATEGORIES.filter((c) => usedCategories.has(c.key)).map((c) => (
            <View key={c.key} style={styles.trendLegendItem}>
              <View style={[styles.trendLegendDot, { backgroundColor: c.color }]} />
              <Text style={styles.trendLegendText}>{c.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </>
  );
}

function StatTile({ label, value, styles, valueStyle, tileStyle, icon, iconColor }) {
  return (
    <View style={[styles.statTile, tileStyle]}>
      {icon && (
        <Ionicons
          name={icon}
          size={46}
          color={iconColor}
          style={styles.statWatermark}
        />
      )}
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, valueStyle]}>${value}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const [payments, setPayments] = useState([]);

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

  const stats = useMemo(() => computeStats(payments), [payments]);
  const overdueCount = useMemo(() => computeOverdueCount(payments), [payments]);
  const disciplineScore = useMemo(() => computeDisciplineScore(payments), [payments]);
  const trend = useMemo(() => computeMonthlyCategoryTrend(payments), [payments]);
  const ledgerTotals = useMemo(() => computeLedgerTotals(payments), [payments]);

  if (payments.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="bar-chart-outline" size={56} color={theme.textMuted} />
        <Text style={styles.emptyTitle}>Nothing to show yet</Text>
        <Text style={styles.emptySubtitle}>
          Add a payment reminder to see your spending overview here.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {overdueCount > 0 && (
        <TouchableOpacity
          style={styles.overdueBanner}
          onPress={() => router.push("/payments")}
        >
          <Ionicons name="alert-circle" size={20} color="#fff" />
          <Text style={styles.overdueBannerText}>
            {overdueCount} {overdueCount === 1 ? "payment is" : "payments are"} overdue!
          </Text>
        </TouchableOpacity>
      )}

      <View style={styles.statRow}>
        <StatTile
          label="Due This Month"
          value={stats.dueThisMonth}
          styles={styles}
          icon="calendar"
          iconColor={withAlpha(theme.warning, 0.18)}
          valueStyle={{ color: theme.warning }}
          tileStyle={{
            backgroundColor: withAlpha(theme.warning, theme.mode === "dark" ? 0.16 : 0.09),
            borderColor: withAlpha(theme.warning, theme.mode === "dark" ? 0.3 : 0.16),
          }}
        />
        <StatTile
          label="Paid This Month"
          value={stats.paidThisMonth}
          styles={styles}
          icon="checkmark-circle"
          iconColor={withAlpha(theme.primary, 0.18)}
          valueStyle={{ color: theme.primary }}
          tileStyle={{
            backgroundColor: withAlpha(theme.primary, theme.mode === "dark" ? 0.18 : 0.1),
            borderColor: withAlpha(theme.primary, theme.mode === "dark" ? 0.32 : 0.18),
          }}
        />
      </View>

      <LinearGradient
        colors={[withAlpha(theme.gradientStart, theme.mode === "dark" ? 0.22 : 0.14), withAlpha(theme.gradientEnd, theme.mode === "dark" ? 0.22 : 0.14)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.statTileWide}
      >
        <Ionicons name="trending-up" size={52} color={withAlpha(theme.brandPurple, 0.2)} style={styles.statWatermark} />
        <Text style={styles.statLabel}>Total Upcoming</Text>
        <Text style={[styles.statValueLarge, { color: theme.brandPurpleDeep }]}>${stats.upcomingTotal}</Text>
      </LinearGradient>

      {disciplineScore !== null && (
        <View
          style={[
            styles.scoreCard,
            {
              backgroundColor: withAlpha(
                disciplineScore >= 90 ? theme.primary : disciplineScore >= 70 ? theme.warning : theme.danger,
                theme.mode === "dark" ? 0.16 : 0.09
              ),
              borderColor: withAlpha(
                disciplineScore >= 90 ? theme.primary : disciplineScore >= 70 ? theme.warning : theme.danger,
                theme.mode === "dark" ? 0.3 : 0.16
              ),
            },
          ]}
        >
          <View
            style={[
              styles.scoreIconBadge,
              {
                backgroundColor: withAlpha(
                  disciplineScore >= 90 ? theme.primary : disciplineScore >= 70 ? theme.warning : theme.danger,
                  theme.mode === "dark" ? 0.28 : 0.18
                ),
              },
            ]}
          >
            <Ionicons
              name="ribbon"
              size={20}
              color={disciplineScore >= 90 ? theme.primary : disciplineScore >= 70 ? theme.warning : theme.danger}
            />
          </View>
          <View style={styles.scoreTextGroup}>
            <Text style={styles.statLabel}>Payment Score</Text>
            <Text style={styles.scoreSubtext}>Share of payments made on time</Text>
          </View>
          <Text
            style={[
              styles.scoreValue,
              { color: disciplineScore >= 90 ? theme.primary : disciplineScore >= 70 ? theme.warning : theme.danger },
            ]}
          >
            {disciplineScore}%
          </Text>
        </View>
      )}

      {(ledgerTotals.totalToReceive > 0 || ledgerTotals.totalToPay > 0) && (
        <>
          <Text style={styles.sectionLabel}>Lending</Text>
          <View style={styles.statRow}>
            <StatTile
              label="You'll Receive"
              value={ledgerTotals.totalToReceive}
              styles={styles}
              icon="arrow-down-circle"
              iconColor={withAlpha(theme.primary, 0.18)}
              valueStyle={{ color: theme.primary }}
              tileStyle={{
                backgroundColor: withAlpha(theme.primary, theme.mode === "dark" ? 0.18 : 0.1),
                borderColor: withAlpha(theme.primary, theme.mode === "dark" ? 0.32 : 0.18),
              }}
            />
            <StatTile
              label="You Owe"
              value={ledgerTotals.totalToPay}
              styles={styles}
              icon="arrow-up-circle"
              iconColor={withAlpha(theme.brandCoral, 0.2)}
              valueStyle={{ color: theme.danger }}
              tileStyle={{
                backgroundColor: withAlpha(theme.brandCoral, theme.mode === "dark" ? 0.16 : 0.1),
                borderColor: withAlpha(theme.brandCoral, theme.mode === "dark" ? 0.3 : 0.16),
              }}
            />
          </View>
        </>
      )}

      <Text style={styles.sectionLabel}>By Category</Text>
      <View style={styles.categoryList}>
        {stats.categoryBreakdown.map((c) => {
          const category = getCategory(c.category);
          return (
            <View key={c.category} style={styles.categoryRow}>
              <View
                style={[
                  styles.categoryIconBadge,
                  { backgroundColor: withAlpha(category.color, theme.mode === "dark" ? 0.22 : 0.14) },
                ]}
              >
                <Ionicons name={category.icon} size={16} color={category.color} />
              </View>
              <View style={styles.categoryBarSection}>
                <View style={styles.categoryTopRow}>
                  <Text style={styles.categoryLabel}>{category.label}</Text>
                  <Text style={styles.categoryAmount}>${c.amount}</Text>
                </View>
                <View
                  style={[
                    styles.categoryBarTrack,
                    { backgroundColor: withAlpha(category.color, theme.mode === "dark" ? 0.16 : 0.1) },
                  ]}
                >
                  <View
                    style={[
                      styles.categoryBarFill,
                      { width: `${Math.max(c.percent, 3)}%`, backgroundColor: category.color },
                    ]}
                  />
                </View>
              </View>
            </View>
          );
        })}
      </View>

      <SpendingTrendsChart trend={trend} styles={styles} theme={theme} />

      {stats.nextPayment && (
        <>
          <Text style={styles.sectionLabel}>Next Payment Due</Text>
          <TouchableOpacity
            style={[
              styles.nextCard,
              {
                backgroundColor: withAlpha(
                  getCategory(stats.nextPayment.category).color,
                  theme.mode === "dark" ? 0.14 : 0.07
                ),
              },
            ]}
            onPress={() => router.push(getPaymentDetailRoute(stats.nextPayment))}
          >
            <View
              style={[
                styles.categoryIconBadge,
                {
                  backgroundColor: withAlpha(
                    getCategory(stats.nextPayment.category).color,
                    theme.mode === "dark" ? 0.22 : 0.14
                  ),
                },
              ]}
            >
              <Ionicons
                name={getCategory(stats.nextPayment.category).icon}
                size={16}
                color={getCategory(stats.nextPayment.category).color}
              />
            </View>
            <View style={styles.nextCardContent}>
              <Text style={styles.nextCardTitle}>{stats.nextPayment.title}</Text>
              <Text style={styles.nextCardDue}>
                Due {formatDate(stats.nextPayment.dueDate)}
              </Text>
            </View>
            <Text style={styles.nextCardAmount}>${stats.nextPayment.amount}</Text>
          </TouchableOpacity>
        </>
      )}

      <AdBanner />
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
    },
    overdueBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: theme.danger,
      borderRadius: 16,
      padding: 16,
      marginBottom: 14,
      shadowColor: theme.danger,
      shadowOpacity: 0.3,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    overdueBannerText: {
      color: "#fff",
      fontSize: 14,
      fontWeight: "700",
      flex: 1,
    },
    emptyContainer: {
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
    statRow: {
      flexDirection: "row",
      gap: 12,
    },
    statTile: {
      flex: 1,
      backgroundColor: theme.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 16,
      overflow: "hidden",
    },
    statWatermark: {
      position: "absolute",
      right: -6,
      top: -6,
    },
    statTileWide: {
      borderRadius: 18,
      padding: 18,
      marginTop: 14,
      overflow: "hidden",
    },
    statLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.textSecondary,
      marginBottom: 6,
    },
    statValue: {
      fontSize: 21,
      fontWeight: "700",
      color: theme.text,
    },
    statValueLarge: {
      fontSize: 30,
      fontWeight: "700",
      color: theme.text,
    },
    scoreCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 16,
      marginTop: 14,
      gap: 12,
    },
    scoreIconBadge: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    scoreTextGroup: {
      flex: 1,
    },
    scoreSubtext: {
      fontSize: 12,
      color: theme.textMuted,
      marginTop: 2,
    },
    scoreValue: {
      fontSize: 24,
      fontWeight: "700",
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.textSecondary,
      marginTop: 28,
      marginBottom: 12,
      letterSpacing: 0.2,
    },
    categoryList: {
      backgroundColor: theme.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 16,
      gap: 16,
    },
    categoryRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    categoryIconBadge: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.primarySoft,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    categoryBarSection: {
      flex: 1,
    },
    categoryTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 6,
    },
    categoryLabel: {
      fontSize: 13,
      color: theme.text,
      fontWeight: "500",
    },
    categoryAmount: {
      fontSize: 13,
      color: theme.textSecondary,
    },
    categoryBarTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.background,
      overflow: "hidden",
    },
    categoryBarFill: {
      height: "100%",
      borderRadius: 3,
      backgroundColor: theme.primary,
    },
    trendChartCard: {
      backgroundColor: theme.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 16,
    },
    trendBarsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
    },
    trendBarColumn: {
      flex: 1,
      alignItems: "center",
    },
    trendBarTrack: {
      width: 22,
      height: 120,
      borderRadius: 6,
      backgroundColor: theme.background,
      justifyContent: "flex-end",
      overflow: "hidden",
    },
    trendBarStack: {
      width: "100%",
      flexDirection: "column-reverse",
    },
    trendBarLabel: {
      fontSize: 11,
      color: theme.textSecondary,
      marginTop: 8,
    },
    trendLegendRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: 12,
      marginTop: 16,
    },
    trendLegendItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    trendLegendDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    trendLegendText: {
      fontSize: 11,
      color: theme.textSecondary,
    },
    nextCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 16,
    },
    nextCardContent: {
      flex: 1,
    },
    nextCardTitle: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.text,
    },
    nextCardDue: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
    nextCardAmount: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.primary,
    },
  });
}
