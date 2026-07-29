import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, PanResponder, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Link, Stack, useLocalSearchParams } from "expo-router";
import { getPayments } from "../../utils/storage";
import { markPaymentPaid, skipPaymentThisMonth } from "../../utils/paymentActions";
import { getCategory } from "../../utils/categories";
import { useTheme, withAlpha } from "../../utils/theme";
import { isDueSoon, getDueUrgency } from "../../utils/dueDate";
import { computeStreak, normalizeHistoryEntry } from "../../utils/streak";
import { computePayoff } from "../../utils/payoff";

const HANDLE_SIZE = 52;

// 16 sparkles, evenly spaced angles par lekin har ek ki apni alag distance aur
// size - taake burst dense lage aur screen ke aadhe hisse tak phail jaye
// (sirf ek chhota sa cluster na ho icon ke qareeb).
const SPARKLE_COUNT = 16;
// Confetti jesa multi-color burst - sirf ek hi rang (theme.primary) ki jagah,
// taake celebration zyada "party" wali lage.
const CONFETTI_COLORS = ["#FBBF24", "#F97316", "#EC4899", "#8B5CF6", "#3B82F6", "#14B8A6"];
const SPARKLES = Array.from({ length: SPARKLE_COUNT }, (_, i) => ({
  angle: (360 / SPARKLE_COUNT) * i,
  distance: 90 + (i % 4) * 30,
  size: 12 + (i % 3) * 5,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
}));

function dueDateTextStyle(urgency, styles) {
  if (urgency === "overdue") return styles.dueDateOverdue;
  if (urgency === "soon") return styles.dueDateSoon;
  return styles.dueDateFar;
}

function formatDate(dateISO) {
  return new Date(dateISO).toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Pichle 6 mahinon mein is payment ki paidHistory se paid/unpaid status nikalta hai -
// isi ek record ka card recycle hota hai, is liye history alag entries se nahi,
// khud payment.paidHistory array se banti hai.
function buildMonthlyHistory(payment) {
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    months.push(new Date(now.getFullYear(), now.getMonth() - i, 1));
  }

  const paidMonthKeys = new Set(
    (payment.paidHistory ?? []).map((raw) => {
      const dt = new Date(normalizeHistoryEntry(raw).dueDate);
      return `${dt.getFullYear()}-${dt.getMonth()}`;
    })
  );
  const skippedMonthKeys = new Set(
    (payment.skippedHistory ?? []).map((d) => {
      const dt = new Date(d);
      return `${dt.getFullYear()}-${dt.getMonth()}`;
    })
  );
  const dueDate = new Date(payment.dueDate);
  const isOverdue = dueDate.getTime() < now.getTime();

  return months.map((d) => {
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const label = d.toLocaleDateString("en-US", { month: "short" });
    if (paidMonthKeys.has(key)) {
      return { label, status: "paid" };
    }
    if (skippedMonthKeys.has(key)) {
      return { label, status: "skipped" };
    }
    const isCurrentDueMonth =
      dueDate.getFullYear() === d.getFullYear() && dueDate.getMonth() === d.getMonth();
    if (isCurrentDueMonth && isOverdue) {
      return { label, status: "unpaid" };
    }
    return { label, status: "none" };
  });
}

// Consecutive on-time payments ka chhota "streak" badge - sirf tab dikhta
// hai jab streak kam az kam 2 ho (1 payment ko "streak" kehna zyada maayne
// nahi rakhta).
function StreakBadge({ streak, styles }) {
  if (streak < 2) return null;
  return (
    <View style={styles.streakBadge}>
      <Text style={styles.streakBadgeText}>🔥 {streak}-payment streak</Text>
    </View>
  );
}

// Loan/payment-plan ka progress bar - "loanTermMonths" set ho tabhi dikhta
// hai. paidOff hote hi ek alag "Paid off!" celebratory state dikhati hai.
function PayoffCard({ payoff, styles, theme }) {
  if (!payoff) return null;

  return (
    <View style={styles.payoffCard}>
      <View style={styles.payoffTopRow}>
        <Text style={styles.payoffLabel}>
          {payoff.isPaidOff ? "Paid off! 🎉" : `${payoff.remaining} payment${payoff.remaining === 1 ? "" : "s"} left`}
        </Text>
        <Text style={styles.payoffPercent}>{payoff.percent}%</Text>
      </View>
      <View style={styles.payoffBarTrack}>
        <View style={[styles.payoffBarFill, { width: `${payoff.percent}%`, backgroundColor: theme.primary }]} />
      </View>
      {!payoff.isPaidOff && (
        <Text style={styles.payoffSubtext}>Debt-free by {formatDate(payoff.payoffDate)}</Text>
      )}
    </View>
  );
}

function statusColor(status, theme) {
  if (status === "paid") return theme.primary;
  if (status === "unpaid") return theme.danger;
  if (status === "skipped") return theme.textMuted;
  return theme.border;
}

// Har month ek chhota colored chip - paid par checkmark, unpaid par cross,
// "none" par khali chip. Koi lines/coordinates nahi, isliye layout ki koi
// pareshani nahi aur GitHub-style contribution squares jesa clean lagta hai.
function HistoryChips({ history, styles, theme }) {
  return (
    <View style={styles.chipsRow}>
      {history.map((m, i) => (
        <View key={i} style={styles.chipColumn}>
          <View style={[styles.chip, { backgroundColor: statusColor(m.status, theme) }]}>
            {m.status === "paid" && <Ionicons name="checkmark" size={14} color="#fff" />}
            {m.status === "unpaid" && <Ionicons name="close" size={14} color="#fff" />}
            {m.status === "skipped" && <Ionicons name="play-skip-forward" size={12} color="#fff" />}
          </View>
          <Text style={styles.graphLabel}>{m.label}</Text>
        </View>
      ))}
    </View>
  );
}

// "Paid" hote hi checkmark ke ird-gird chhote sparkle icons pop hoke fade-out
// hote hain - sirf ek dafa, jab "trigger" (celebrationKey) badalta hai.
// Pehli mount par (trigger 0/undefined) kuch nahi hota, taake pehle se paid
// payment dobara khulne par yeh celebration na dohraye.
function SparkleBurst({ trigger }) {
  const anims = useRef(SPARKLES.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (!trigger) return;
    anims.forEach((v) => v.setValue(0));
    Animated.stagger(
      30,
      anims.map((v) =>
        Animated.sequence([
          Animated.timing(v, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: 550, useNativeDriver: true }),
        ])
      )
    ).start();
  }, [trigger]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {SPARKLES.map((sparkle, i) => {
        const rad = (sparkle.angle * Math.PI) / 180;
        const anim = anims[i];
        return (
          <Animated.View
            key={i}
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              opacity: anim,
              transform: [
                {
                  translateX: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, Math.cos(rad) * sparkle.distance],
                  }),
                },
                {
                  translateY: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, Math.sin(rad) * sparkle.distance],
                  }),
                },
                { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.1] }) },
              ],
            }}
          >
            <Ionicons name="sparkles" size={sparkle.size} color={sparkle.color} />
          </Animated.View>
        );
      })}
    </View>
  );
}

function PaidStatus({ payment, celebrationKey, theme, styles, categoryColor }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    opacity.setValue(0);
    Animated.timing(opacity, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [payment.id, payment.isPaid, payment.dueDate]);

  return (
    <Animated.View
      style={[
        styles.paidStatus,
        { opacity, backgroundColor: withAlpha(categoryColor, theme.mode === "dark" ? 0.25 : 0.14) },
      ]}
    >
      <View style={styles.paidIconWrap}>
        <Ionicons name="checkmark-circle" size={22} color={categoryColor} />
        <SparkleBurst trigger={celebrationKey} />
      </View>
      <Text style={[styles.paidStatusText, { color: categoryColor }]}>
        {payment.isRecurring
          ? `Paid — next due ${formatDate(payment.dueDate)}`
          : `Paid on ${formatDate(payment.paidDate)}`}
      </Text>
    </Animated.View>
  );
}

function SwipeToPay({ onComplete, theme, styles, categoryColor }) {
  const trackWidth = useRef(0);
  const pan = useRef(new Animated.Value(0)).current;
  const [locked, setLocked] = useState(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !locked,
      onMoveShouldSetPanResponder: (_, gesture) => !locked && Math.abs(gesture.dx) > 2,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, gesture) => {
        const maxX = Math.max(trackWidth.current - HANDLE_SIZE, 0);
        const x = Math.min(Math.max(gesture.dx, 0), maxX);
        pan.setValue(x);
      },
      onPanResponderRelease: (_, gesture) => {
        const maxX = Math.max(trackWidth.current - HANDLE_SIZE, 0);
        if (maxX > 0 && gesture.dx > maxX * 0.6) {
          setLocked(true);
          // Native driver par spring - handle satisfying tarah se end tak "settle" hoti hai.
          Animated.spring(pan, {
            toValue: maxX,
            bounciness: 6,
            speed: 16,
            useNativeDriver: true,
          }).start(() => onComplete());
        } else {
          Animated.spring(pan, {
            toValue: 0,
            friction: 6,
            tension: 60,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const maxTrack = Math.max(trackWidth.current - HANDLE_SIZE, 1);
  const labelOpacity = pan.interpolate({
    inputRange: [0, maxTrack],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  return (
    <View
      style={[
        styles.swipeTrack,
        { backgroundColor: withAlpha(categoryColor, theme.mode === "dark" ? 0.25 : 0.14) },
      ]}
      onLayout={(e) => {
        trackWidth.current = e.nativeEvent.layout.width;
      }}
    >
      <Animated.Text style={[styles.swipeLabel, { opacity: labelOpacity, color: categoryColor }]}>
        Swipe right to mark as paid
      </Animated.Text>
      <Animated.View
        {...panResponder.panHandlers}
        style={[styles.swipeHandle, { backgroundColor: categoryColor, transform: [{ translateX: pan }] }]}
      >
        <Ionicons name="chevron-forward" size={22} color="#fff" />
      </Animated.View>
    </View>
  );
}

export default function PaymentDetailScreen() {
  const { id } = useLocalSearchParams();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);

  const [payment, setPayment] = useState(null);
  // 0 = koi celebration nahi hui (screen abhi khuli hai ya payment pehle se paid thi).
  // Har real swipe-complete par yeh badhta hai, jisse SparkleBurst chalta hai.
  const [celebrationKey, setCelebrationKey] = useState(0);

  useEffect(() => {
    load();
  }, [id]);

  async function load() {
    const payments = await getPayments();
    const current = payments.find((p) => p.id === id);
    setPayment(current ?? null);
  }

  async function handleSwipeComplete() {
    if (!payment) return;
    await markPaymentPaid(payment);
    setCelebrationKey((k) => k + 1);
    load();
  }

  function handleSkip() {
    Alert.alert(
      "Skip this month?",
      `${payment.title} will move to next month's due date without being marked as paid.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Skip",
          style: "destructive",
          onPress: async () => {
            await skipPaymentThisMonth(payment);
            load();
          },
        },
      ]
    );
  }

  if (!payment) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: "Payment" }} />
      </View>
    );
  }

  const category = getCategory(payment.category);
  const dueSoon = isDueSoon(payment.dueDate);
  // Recurring payment ka card recycle hota hai - is liye "handled" (Paid status dikhana)
  // tab hi hai jab paid ho AUR agli due date abhi door ho. Due qareeb aate hi dobara
  // action chahiye hoti hai, chahe pichli baar paid hi kyun na ki ho.
  const isHandled = payment.isRecurring ? payment.isPaid && !dueSoon : payment.isPaid;

  return (
    <ScrollView
      style={styles.scrollContainer}
      contentContainerStyle={styles.container}
    >
      <Stack.Screen
        options={{
          title: "Payment Details",
          headerStyle: {
            backgroundColor: withAlpha(category.color, theme.mode === "dark" ? 0.22 : 0.1),
          },
          headerRight: () => (
            <Link href={{ pathname: "/add-payment", params: { id: payment.id } }} asChild>
              <TouchableOpacity style={styles.editButton}>
                <Ionicons name="pencil" size={20} color={category.color} />
              </TouchableOpacity>
            </Link>
          ),
        }}
      />

      <View
        style={[
          styles.iconBadge,
          { backgroundColor: withAlpha(category.color, theme.mode === "dark" ? 0.22 : 0.14) },
        ]}
      >
        <Ionicons name={category.icon} size={28} color={category.color} />
      </View>

      <Text style={styles.title}>{payment.title}</Text>
      <Text style={styles.amount}>${payment.amount}</Text>
      <Text style={dueDateTextStyle(getDueUrgency(payment.dueDate), styles)}>
        Due: {formatDate(payment.dueDate)}
      </Text>
      {payment.isRecurring && <StreakBadge streak={computeStreak(payment)} styles={styles} />}

      <PayoffCard payoff={computePayoff(payment)} styles={styles} theme={theme} />

      {payment.isRecurring && (
        <>
          <Text style={styles.sectionLabel}>Monthly Payment History</Text>
          <HistoryChips history={buildMonthlyHistory(payment)} styles={styles} theme={theme} />
        </>
      )}

      {isHandled ? (
        <PaidStatus
          payment={payment}
          celebrationKey={celebrationKey}
          theme={theme}
          styles={styles}
          categoryColor={category.color}
        />
      ) : (
        <>
          <SwipeToPay
            onComplete={handleSwipeComplete}
            theme={theme}
            styles={styles}
            categoryColor={category.color}
          />
          {payment.isRecurring && (
            <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
              <Text style={styles.skipButtonText}>Skip this month</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </ScrollView>
  );
}

function getStyles(theme) {
  return StyleSheet.create({
    // Payoff card + poori monthly history + skip button jaise optional
    // sections chhoti screens par mila kar viewport se lambe ho sakte hain,
    // is liye poora content ScrollView mein hai (container ab uski
    // contentContainerStyle hai, isi liye "flex: 1" yahan nahi, scrollContainer mein hai).
    scrollContainer: {
      flex: 1,
      backgroundColor: theme.background,
    },
    container: {
      alignItems: "center",
      padding: 24,
    },
    editButton: {
      marginRight: 12,
      padding: 4,
    },
    iconBadge: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: theme.primarySoft,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 12,
      marginBottom: 16,
    },
    title: {
      fontSize: 24,
      fontWeight: "700",
      color: theme.text,
      textAlign: "center",
    },
    amount: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.primary,
      marginTop: 6,
    },
    dueDateOverdue: {
      fontSize: 14,
      color: theme.danger,
      fontWeight: "600",
      marginTop: 6,
    },
    dueDateSoon: {
      fontSize: 14,
      color: theme.warning,
      fontWeight: "600",
      marginTop: 6,
    },
    dueDateFar: {
      fontSize: 14,
      color: theme.text,
      marginTop: 6,
    },
    streakBadge: {
      backgroundColor: theme.dangerSoft,
      paddingVertical: 5,
      paddingHorizontal: 12,
      borderRadius: 14,
      marginTop: 10,
    },
    streakBadgeText: {
      fontSize: 12,
      fontWeight: "700",
      color: theme.text,
    },
    payoffCard: {
      width: "100%",
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      marginTop: 16,
    },
    payoffTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    payoffLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.text,
    },
    payoffPercent: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.primary,
    },
    payoffBarTrack: {
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.background,
      overflow: "hidden",
    },
    payoffBarFill: {
      height: "100%",
      borderRadius: 4,
    },
    payoffSubtext: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 8,
    },
    sectionLabel: {
      alignSelf: "flex-start",
      fontSize: 13,
      fontWeight: "600",
      color: theme.textSecondary,
      marginTop: 32,
      marginBottom: 12,
    },
    chipsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      width: "100%",
    },
    chipColumn: {
      alignItems: "center",
      gap: 6,
    },
    chip: {
      width: 32,
      height: 32,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    graphLabel: {
      fontSize: 11,
      color: theme.textSecondary,
    },
    paidStatus: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: "auto",
      marginBottom: 16,
      backgroundColor: theme.primarySoft,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 30,
    },
    paidIconWrap: {
      alignItems: "center",
      justifyContent: "center",
    },
    paidStatusText: {
      color: theme.primary,
      fontWeight: "600",
      fontSize: 15,
    },
    swipeTrack: {
      marginTop: "auto",
      marginBottom: 16,
      width: "100%",
      height: 60,
      borderRadius: 30,
      backgroundColor: theme.primarySoft,
      justifyContent: "center",
      overflow: "hidden",
    },
    swipeLabel: {
      position: "absolute",
      alignSelf: "center",
      color: theme.primary,
      fontWeight: "600",
      fontSize: 14,
    },
    skipButton: {
      alignItems: "center",
      paddingVertical: 4,
    },
    skipButtonText: {
      color: theme.textSecondary,
      fontSize: 13,
      fontWeight: "600",
      textDecorationLine: "underline",
    },
    swipeHandle: {
      width: HANDLE_SIZE,
      height: HANDLE_SIZE,
      borderRadius: HANDLE_SIZE / 2,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 4,
    },
  });
}
