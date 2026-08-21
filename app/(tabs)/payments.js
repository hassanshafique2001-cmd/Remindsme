import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  FlatList,
  LayoutAnimation,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { Link, useFocusEffect, useNavigation, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { deletePayment, getPayments } from "../../utils/storage";
import { cancelPaymentReminder } from "../../utils/notifications";
import { exportPaymentsToCsv } from "../../utils/exportPayments";
import { recordAppOpened } from "../../utils/paymentAppState";
import { CATEGORIES, getCategory } from "../../utils/categories";
import { useTheme, withAlpha } from "../../utils/theme";
import { isDueSoon, getDueUrgency, isDueWithinOneDay } from "../../utils/dueDate";
import { getPaymentDetailRoute } from "../../utils/ledger";
import { AdBanner } from "../../components/AdBanner";
import { getDefaultViewMode } from "../../utils/viewPreference";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const SORT_OPTIONS = [
  { key: "dueDate", label: "Due Date" },
  { key: "amount", label: "Amount" },
];

const DELETE_WIDTH = 76;

function formatDate(dateISO) {
  return new Date(dateISO).toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const MONTH_LABEL = new Date().toLocaleDateString("en-US", { month: "long" });

// Is mahine mein due hone wali outstanding payments ka total aur count -
// recurring cards hamesha "outstanding" ginte hain (Dashboard ke computeStats
// jesi hi logic, yahan simplified kyunki sirf ek number chahiye).
function computeMonthSummary(payments) {
  const now = new Date();
  let total = 0;
  let count = 0;
  payments.forEach((p) => {
    const isOutstanding = p.isRecurring || !p.isPaid;
    if (!isOutstanding) return;
    const due = new Date(p.dueDate);
    if (due.getMonth() === now.getMonth() && due.getFullYear() === now.getFullYear()) {
      total += p.amount;
      count += 1;
    }
  });
  return { total, count };
}

function MonthSummaryCard({ payments, styles, theme }) {
  const { total, count } = useMemo(() => computeMonthSummary(payments), [payments]);
  if (count === 0) return null;

  return (
    <LinearGradient
      colors={[withAlpha(theme.gradientStart, theme.mode === "dark" ? 0.24 : 0.15), withAlpha(theme.gradientEnd, theme.mode === "dark" ? 0.24 : 0.15)]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.monthSummary}
    >
      <View style={[styles.monthSummaryIconBadge, { backgroundColor: withAlpha(theme.brandPurple, theme.mode === "dark" ? 0.3 : 0.18) }]}>
        <Ionicons name="calendar-outline" size={20} color={theme.brandPurpleDeep} />
      </View>
      <View style={styles.monthSummaryText}>
        <Text style={styles.monthSummaryLabel}>Due in {MONTH_LABEL}</Text>
        <Text style={styles.monthSummaryValue}>
          ${total} · {count} {count === 1 ? "payment" : "payments"}
        </Text>
      </View>
    </LinearGradient>
  );
}

// Pehle provider ki app khud kholne ki koshish karte hain (agar uska custom
// URL scheme maloom ho aur wo app installed ho); warna website khol dete hain -
// agar us provider ki app Universal Links support karti ho to https link khud
// b khud app mein khul jata hai, warna normal browser mein.
async function handleOpenApp(paymentId, appScheme, webUrl) {
  // Yaad rakhte hain kaunsi payment ke liye app khola gaya - taake user jab
  // wapis Reminds Me pe aaye to "kya payment ho gayi?" pooch sakein.
  recordAppOpened(paymentId);
  try {
    if (appScheme) {
      const canOpen = await Linking.canOpenURL(appScheme);
      if (canOpen) {
        await Linking.openURL(appScheme);
        return;
      }
    }
    if (webUrl) {
      await Linking.openURL(webUrl);
      return;
    }
  } catch {
    Alert.alert(
      "Couldn't Open",
      "This app isn't installed on this device, or the link is invalid."
    );
  }
}

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

// Diye gaye mahine ke din-by-din cells banata hai - har cell apni us din due
// hone wali payments (filtered list se) le kar aata hai. Mahine ke shuru mein
// jitne khali din hain (Sunday se start), utne "null" cells lagate hain taake
// grid sahi weekday se align ho.
function buildCalendarCells(monthDate, payments) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dayPayments = payments.filter((p) => {
      const due = new Date(p.dueDate);
      return due.getFullYear() === year && due.getMonth() === month && due.getDate() === d;
    });
    cells.push({ day: d, payments: dayPayments });
  }
  return cells;
}

// List ka alternative - ek mahine ka grid, har din pe us din due hone wali
// payments ke category-color dots. Din tap karne se neeche uska agenda
// (us din ki payments) dikhta hai.
function CalendarView({ payments, styles, theme, onSelectPayment }) {
  const today = new Date();
  const [monthDate, setMonthDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(
    monthDate.getMonth() === today.getMonth() && monthDate.getFullYear() === today.getFullYear()
      ? today.getDate()
      : null
  );

  const cells = useMemo(() => buildCalendarCells(monthDate, payments), [monthDate, payments]);

  function changeMonth(delta) {
    const next = new Date(monthDate.getFullYear(), monthDate.getMonth() + delta, 1);
    setMonthDate(next);
    setSelectedDay(
      next.getMonth() === today.getMonth() && next.getFullYear() === today.getFullYear()
        ? today.getDate()
        : null
    );
  }

  const selectedCell = cells.find((c) => c && c.day === selectedDay);
  const dayPayments = selectedCell ? selectedCell.payments : [];

  return (
    <View style={styles.calendarWrap}>
      <View style={styles.calendarHeaderRow}>
        <TouchableOpacity onPress={() => changeMonth(-1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={20} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.calendarMonthLabel}>
          {monthDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </Text>
        <TouchableOpacity onPress={() => changeMonth(1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-forward" size={20} color={theme.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.calendarWeekRow}>
        {WEEKDAY_LABELS.map((w, i) => (
          <Text key={i} style={styles.calendarWeekdayLabel}>
            {w}
          </Text>
        ))}
      </View>

      <View style={styles.calendarGrid}>
        {cells.map((cell, i) => {
          if (!cell) return <View key={i} style={styles.calendarCell} />;
          const isSelected = cell.day === selectedDay;
          const isToday =
            cell.day === today.getDate() &&
            monthDate.getMonth() === today.getMonth() &&
            monthDate.getFullYear() === today.getFullYear();
          const dotColors = [...new Set(cell.payments.map((p) => getCategory(p.category).color))].slice(0, 3);
          return (
            <TouchableOpacity
              key={i}
              style={[
                styles.calendarCell,
                isSelected && { backgroundColor: withAlpha(theme.primary, theme.mode === "dark" ? 0.28 : 0.15) },
              ]}
              onPress={() => setSelectedDay(cell.day)}
            >
              <Text
                style={[
                  styles.calendarDayText,
                  isToday && { color: theme.primary, fontWeight: "700" },
                  isSelected && { color: theme.primary, fontWeight: "700" },
                ]}
              >
                {cell.day}
              </Text>
              <View style={styles.calendarDotsRow}>
                {dotColors.map((c, idx) => (
                  <View key={idx} style={[styles.calendarDot, { backgroundColor: c }]} />
                ))}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.calendarAgenda}>
        {selectedDay === null ? (
          <Text style={styles.calendarEmptyText}>Tap a day to see its payments.</Text>
        ) : dayPayments.length === 0 ? (
          <Text style={styles.calendarEmptyText}>No payments due this day.</Text>
        ) : (
          dayPayments.map((p) => (
            <PaymentCard key={p.id} payment={p} onPress={() => onSelectPayment(p)} styles={styles} theme={theme} />
          ))
        )}
      </View>
    </View>
  );
}

// Overdue (red) aur "jald due hone wali" (amber) ko alag dikhate hain - taake
// genuinely overdue payment amber "bas ek hafta hai" wali payment jesi na lage.
function dueDateStyle(urgency, styles) {
  if (urgency === "overdue") return styles.cardDueOverdue;
  if (urgency === "soon") return styles.cardDueSoon;
  return styles.cardDueFar;
}

// Due date "aaj" ya "1 din baaki" ho to due-date ke saath ek dheeme se
// blink karte caution icon dikhate hain - sirf itna hi (koi text/logic change
// nahi), taake user ka dhyan seedha us payment ki taraf jaye. Fade 100% <-> 45%
// ke beech, calm/na-aggressive - "emergency alarm" jesa nahi.
function UrgentPulseIcon({ theme }) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.45, duration: 900, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View style={{ opacity }}>
      <Ionicons name="alert-circle" size={14} color={theme.warning} />
    </Animated.View>
  );
}

function PaymentCard({ payment, onPress, styles, theme }) {
  const category = getCategory(payment.category);

  // Recurring payment ka card hamesha "Upcoming" mein rehta hai (naya card nahi banta) -
  // is liye uska "Paid" tag sirf tab dikhta hai jab agli due date door ho. Ek baar wali
  // (non-recurring) payment paid hone ke baad hamesha paid hi rehti hai.
  const showPaidTag = payment.isPaid && (!payment.isRecurring || !isDueSoon(payment.dueDate));
  const showPaidDateInstead = payment.isPaid && !payment.isRecurring;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      {showPaidTag && (
        <View style={styles.paidTagRow}>
          <View style={styles.paidTag}>
            <Ionicons name="checkmark-circle" size={14} color="#fff" />
            <Text style={styles.paidTagText}>Paid</Text>
          </View>
        </View>
      )}
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
            <Text style={styles.cardTitle}>{payment.title}</Text>
            <Text style={styles.cardAmount}>${payment.amount}</Text>
          </View>
          <View style={styles.cardRow}>
            <Text style={styles.cardCategory}>
              {payment.category === "ledger"
                ? payment.ledgerDirection === "borrowed"
                  ? "You Owe"
                  : "Owes You"
                : category.label}
            </Text>
            {showPaidDateInstead ? (
              <Text style={styles.cardPaid}>Paid on {formatDate(payment.paidDate)}</Text>
            ) : (
              <View style={styles.dueDateRow}>
                {isDueWithinOneDay(payment.dueDate) && <UrgentPulseIcon theme={theme} />}
                <Text style={dueDateStyle(getDueUrgency(payment.dueDate), styles)}>
                  Due: {formatDate(payment.dueDate)}
                </Text>
              </View>
            )}
          </View>
        </View>
        {(payment.appScheme || payment.appWebUrl) ? (
          <TouchableOpacity
            style={styles.openAppButton}
            onPress={() => handleOpenApp(payment.id, payment.appScheme, payment.appWebUrl)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="share-outline" size={16} color={theme.primary} />
          </TouchableOpacity>
        ) : null}
        {payment.phoneNumber ? (
          <TouchableOpacity
            style={styles.openAppButton}
            onPress={() => Linking.openURL(`tel:${payment.phoneNumber}`)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="call-outline" size={16} color={theme.primary} />
          </TouchableOpacity>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

// Card ko left swipe karne par peeche ek delete (dustbin) button reveal hota
// hai. Hand-rolled PanResponder wala pehla version kabhi kabhi beech mein
// atak jata tha aur smooth nahi tha - ab "react-native-gesture-handler" ki
// battle-tested "Swipeable" use karte hain, jo yehi kaam nativately, buttery
// smooth tareeqe se karta hai (velocity-aware open/close, koi manual
// threshold math nahi).
function SwipeableRow({ children, onDelete, styles }) {
  const swipeableRef = useRef(null);

  function handleDeletePress() {
    swipeableRef.current?.close();
    onDelete();
  }

  function renderRightActions(_progress, dragX) {
    // Delete background sirf tabhi dikhta hai jab row asal mein swipe ho rahi
    // ho - row band hote hue bhi card ke apne tap-press dim effect ki wajah
    // se peeche se laal na dikhe.
    const opacity = dragX.interpolate({
      inputRange: [-DELETE_WIDTH, 0],
      outputRange: [1, 0],
      extrapolate: "clamp",
    });
    return (
      <Animated.View style={[styles.deleteAction, { opacity }]}>
        <TouchableOpacity style={styles.deleteButton} onPress={handleDeletePress}>
          <Ionicons name="trash-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <View style={styles.swipeableContainer}>
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        overshootRight={false}
        rightThreshold={40}
        friction={1.5}
      >
        {children}
      </Swipeable>
    </View>
  );
}

export default function PaymentsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);

  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("upcoming");
  const [searchText, setSearchText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [sortBy, setSortBy] = useState("dueDate");
  // "list" ya "calendar" - sirf Upcoming tab par lagu hota hai. Iski choice
  // ab Profile tab mein hoti hai (device-level default), yahan sirf load hoti
  // hai - is liye har focus par dobara padhte hain taake Profile mein badlaw
  // turant reflect ho jaye.
  const [viewMode, setViewMode] = useState("list");

  async function loadPayments(animate = true) {
    const data = await getPayments();
    if (animate) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setPayments(data);
    setLoading(false);
  }

  // useFocusEffect har baar chalta hai jab yeh screen focus mein aati hai
  // (jaise Payment Detail screen se wapis aane par) - taake list refresh ho jaye.
  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      (async () => {
        const [data, mode] = await Promise.all([getPayments(), getDefaultViewMode()]);
        if (isActive) {
          setPayments(data);
          setViewMode(mode);
          setLoading(false);
        }
      })();
      return () => {
        isActive = false;
      };
    }, [])
  );

  async function handleRefresh() {
    setRefreshing(true);
    await loadPayments();
    setRefreshing(false);
  }

  async function handleDelete(payment) {
    await cancelPaymentReminder(payment.notificationId);
    await deletePayment(payment.id);
    loadPayments();
  }

  async function handleExport() {
    try {
      await exportPaymentsToCsv(payments);
    } catch (e) {
      Alert.alert("Export Failed", e.message);
    }
  }

  // Payments (Tabs.Screen) ka header khud is component ke bahar layout.js mein
  // define hota hai - is liye export button yahan navigation.setOptions se
  // dynamically lagate hain, taake usay current "payments" state mil sake.
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity style={styles.exportButton} onPress={handleExport}>
          <Ionicons name="share-outline" size={22} color={theme.primary} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, payments, theme]);

  // Recurring payments hamesha Upcoming mein rehti hain (unka card recycle hota hai) -
  // sirf ek-baar wali (non-recurring) payments paid hone ke baad "Paid" tab mein jati hain.
  const upcoming = useMemo(
    () => payments.filter((p) => p.isRecurring || !p.isPaid),
    [payments]
  );
  const history = useMemo(
    () =>
      payments
        .filter((p) => !p.isRecurring && p.isPaid)
        .sort((a, b) => new Date(b.paidDate) - new Date(a.paidDate)),
    [payments]
  );

  const visibleUpcoming = useMemo(() => {
    let list = upcoming;
    if (selectedCategory) {
      list = list.filter((p) => p.category === selectedCategory);
    }
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      list = list.filter((p) => p.title.toLowerCase().includes(q));
    }
    list = [...list].sort((a, b) =>
      sortBy === "amount"
        ? b.amount - a.amount
        : new Date(a.dueDate) - new Date(b.dueDate)
    );
    return list;
  }, [upcoming, selectedCategory, searchText, sortBy]);

  // History apni khud ki chronological (most-recently-paid-first) order rakhti
  // hai - is liye yahan sirf search/category filter lagate hain, dueDate/amount
  // sort dobara apply nahi karte.
  const visibleHistory = useMemo(() => {
    let list = history;
    if (selectedCategory) {
      list = list.filter((p) => p.category === selectedCategory);
    }
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      list = list.filter((p) => p.title.toLowerCase().includes(q));
    }
    return list;
  }, [history, selectedCategory, searchText]);

  const list = activeTab === "upcoming" ? visibleUpcoming : visibleHistory;
  const hasActiveFilter = Boolean(selectedCategory || searchText.trim());

  // Ad banner ko list ke andar hi ek "card slot" ki tarah dikhate hain -
  // 3rd card ke baad 4th slot pe (3 se kam cards hon to sabse aakhir mein).
  const listWithAd = useMemo(() => {
    if (list.length === 0) return list;
    const withAd = [...list];
    withAd.splice(Math.min(3, list.length), 0, { id: "__ad_banner__", isAdSlot: true });
    return withAd;
  }, [list]);

  return (
    <View style={styles.container}>
      <MonthSummaryCard payments={payments} styles={styles} theme={theme} />
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "upcoming" && styles.tabActive]}
          onPress={() => setActiveTab("upcoming")}
        >
          <Text style={[styles.tabText, activeTab === "upcoming" && styles.tabTextActive]}>
            Upcoming
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "history" && styles.tabActive]}
          onPress={() => setActiveTab("history")}
        >
          <Text style={[styles.tabText, activeTab === "history" && styles.tabTextActive]}>
            Paid
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filters}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search payments..."
          placeholderTextColor={theme.textMuted}
          value={searchText}
          onChangeText={setSearchText}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          <TouchableOpacity
            style={[styles.chip, !selectedCategory && styles.chipActive]}
            onPress={() => setSelectedCategory(null)}
          >
            <Text style={[styles.chipText, !selectedCategory && styles.chipTextActive]}>
              All
            </Text>
          </TouchableOpacity>
          {CATEGORIES.map((c) => {
            const active = selectedCategory === c.key;
            return (
              <TouchableOpacity
                key={c.key}
                style={[
                  styles.chip,
                  active && { backgroundColor: c.color, borderColor: c.color },
                ]}
                onPress={() => setSelectedCategory(active ? null : c.key)}
              >
                <Ionicons
                  name={c.icon}
                  size={14}
                  color={active ? "#fff" : c.color}
                  style={styles.chipIcon}
                />
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        {activeTab === "upcoming" && (
          <View style={styles.sortRow}>
            <Text style={styles.sortLabel}>Sort by:</Text>
            {SORT_OPTIONS.map((s) => (
              <TouchableOpacity
                key={s.key}
                style={[styles.sortChip, sortBy === s.key && styles.sortChipActive]}
                onPress={() => setSortBy(s.key)}
              >
                <Text
                  style={[styles.sortChipText, sortBy === s.key && styles.sortChipTextActive]}
                >
                  {s.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {activeTab === "upcoming" && viewMode === "calendar" ? (
        <ScrollView contentContainerStyle={styles.list}>
          <CalendarView
            payments={visibleUpcoming}
            styles={styles}
            theme={theme}
            onSelectPayment={(payment) => router.push(getPaymentDetailRoute(payment))}
          />
        </ScrollView>
      ) : !loading && list.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons
            name={activeTab === "upcoming" ? "wallet-outline" : "checkmark-done-circle-outline"}
            size={56}
            color={theme.textMuted}
          />
          <Text style={styles.emptyTitle}>
            {hasActiveFilter
              ? "No matching payments"
              : activeTab === "upcoming"
              ? "No payments found"
              : "No paid payments yet"}
          </Text>
          <Text style={styles.emptySubtitle}>
            {hasActiveFilter
              ? "Try a different search term or category."
              : activeTab === "upcoming"
              ? "Tap the button below to add a payment reminder."
              : "One-time payments you mark as paid will show up here."}
          </Text>
          <AdBanner />
          <AdBanner />
        </View>
      ) : (
        <FlatList
          data={listWithAd}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) =>
            item.isAdSlot ? (
              <AdBanner />
            ) : (
              <SwipeableRow onDelete={() => handleDelete(item)} styles={styles}>
                <PaymentCard
                  payment={item}
                  onPress={() => router.push(getPaymentDetailRoute(item))}
                  styles={styles}
                  theme={theme}
                />
              </SwipeableRow>
            )
          }
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.primary}
              colors={[theme.primary]}
            />
          }
        />
      )}

      <Link href="/choose-payment-type" asChild>
        <TouchableOpacity style={styles.fab} activeOpacity={0.85}>
          <LinearGradient
            colors={[theme.gradientStart, theme.gradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.fabGradient}
          >
            <Text style={styles.fabText}>+</Text>
          </LinearGradient>
        </TouchableOpacity>
      </Link>
    </View>
  );
}

function getStyles(theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    exportButton: {
      marginRight: 12,
      padding: 4,
    },
    calendarWrap: {
      width: "100%",
    },
    calendarHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    calendarMonthLabel: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.text,
    },
    calendarWeekRow: {
      flexDirection: "row",
      marginBottom: 4,
    },
    calendarWeekdayLabel: {
      flex: 1,
      textAlign: "center",
      fontSize: 11,
      color: theme.textMuted,
      fontWeight: "600",
    },
    calendarGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
    },
    calendarCell: {
      width: "14.28%",
      aspectRatio: 1,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 10,
      marginBottom: 2,
    },
    calendarDayText: {
      fontSize: 13,
      color: theme.text,
    },
    calendarDotsRow: {
      flexDirection: "row",
      gap: 2,
      marginTop: 3,
      height: 6,
    },
    calendarDot: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
    },
    calendarAgenda: {
      marginTop: 16,
      gap: 12,
    },
    calendarEmptyText: {
      fontSize: 13,
      color: theme.textSecondary,
      textAlign: "center",
      marginTop: 20,
    },
    monthSummary: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: 16,
      marginTop: 12,
      marginBottom: 4,
      padding: 16,
      borderRadius: 18,
    },
    monthSummaryIconBadge: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: withAlpha(theme.info, theme.mode === "dark" ? 0.3 : 0.16),
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    monthSummaryText: {
      flex: 1,
    },
    monthSummaryLabel: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    monthSummaryValue: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.text,
      marginTop: 2,
    },
    tabRow: {
      flexDirection: "row",
      backgroundColor: theme.surface,
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 2,
      gap: 8,
    },
    tab: {
      paddingVertical: 9,
      paddingHorizontal: 18,
      marginBottom: 8,
      borderRadius: 20,
      backgroundColor: theme.surfaceSoft,
    },
    tabActive: {
      backgroundColor: withAlpha(theme.brandPurple, theme.mode === "dark" ? 0.3 : 0.16),
    },
    tabText: {
      fontSize: 14,
      color: theme.textSecondary,
      fontWeight: "700",
    },
    tabTextActive: {
      color: theme.brandPurpleDeep,
    },
    filters: {
      backgroundColor: theme.surface,
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    searchInput: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      padding: 10,
      fontSize: 14,
      marginTop: 10,
      color: theme.text,
    },
    chipRow: {
      gap: 8,
      marginTop: 10,
    },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.border,
    },
    chipActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    chipIcon: {
      marginRight: 4,
    },
    chipText: {
      color: theme.text,
      fontSize: 12,
    },
    chipTextActive: {
      color: "#fff",
    },
    sortRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 10,
      gap: 8,
    },
    sortLabel: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    sortChip: {
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
    },
    sortChipActive: {
      backgroundColor: theme.primarySoft,
      borderColor: theme.primary,
    },
    sortChipText: {
      fontSize: 12,
      color: theme.text,
    },
    sortChipTextActive: {
      color: theme.primary,
      fontWeight: "600",
    },
    list: {
      padding: 16,
    },
    swipeableContainer: {
      marginBottom: 12,
      borderRadius: 12,
      overflow: "hidden",
    },
    deleteAction: {
      width: DELETE_WIDTH,
      backgroundColor: theme.danger,
      alignItems: "center",
      justifyContent: "center",
    },
    deleteButton: {
      width: "100%",
      height: "100%",
      alignItems: "center",
      justifyContent: "center",
    },
    card: {
      backgroundColor: theme.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 16,
      shadowColor: theme.mode === "dark" ? "#000" : theme.brandPurple,
      shadowOpacity: theme.mode === "dark" ? 0.3 : 0.06,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 3 },
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
    paidTagRow: {
      flexDirection: "row",
      justifyContent: "flex-end",
      marginBottom: 8,
    },
    paidTag: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.primary,
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 12,
      gap: 4,
    },
    paidTagText: {
      color: "#fff",
      fontSize: 12,
      fontWeight: "700",
    },
    cardContent: {
      flex: 1,
    },
    cardRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 4,
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
    cardCategory: {
      fontSize: 13,
      color: theme.textSecondary,
    },
    dueDateRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    cardDueOverdue: {
      fontSize: 13,
      color: theme.danger,
      fontWeight: "600",
    },
    cardDueSoon: {
      fontSize: 13,
      color: theme.warning,
      fontWeight: "600",
    },
    cardDueFar: {
      fontSize: 13,
      color: theme.text,
    },
    cardPaid: {
      fontSize: 13,
      color: theme.primary,
    },
    emptyState: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
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
    fab: {
      position: "absolute",
      right: 20,
      bottom: 30,
      width: 58,
      height: 58,
      borderRadius: 29,
      elevation: 6,
      shadowColor: theme.brandPurple,
      shadowOpacity: 0.4,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
    },
    fabGradient: {
      width: "100%",
      height: "100%",
      borderRadius: 29,
      alignItems: "center",
      justifyContent: "center",
    },
    fabText: {
      color: "#fff",
      fontSize: 28,
      lineHeight: 30,
    },
    openAppButton: {
      alignSelf: "center",
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: theme.primarySoft,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 8,
    },
  });
}
