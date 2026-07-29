import { useEffect, useRef, useState } from "react";
import { Alert, AppState, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useFonts, Pacifico_400Regular } from "@expo-google-fonts/pacifico";
import { Quicksand_700Bold } from "@expo-google-fonts/quicksand";
import * as SplashScreen from "expo-splash-screen";
import {
  configureNotificationHandler,
  configureNotificationCategories,
  requestNotificationPermissions,
  snoozePaymentReminderToTomorrow,
  REMIND_TOMORROW_ACTION,
} from "../utils/notifications";
import { getPayments, updatePayment } from "../utils/storage";
import { markPaymentPaid } from "../utils/paymentActions";
import { consumeRecentlyOpenedPayment } from "../utils/paymentAppState";
import { isAppLockEnabled, authenticateWithBiometrics } from "../utils/appLock";
import { adsSupported } from "../utils/ads";
import { initAds } from "../utils/initAds";
import { scheduleWeeklyDigest } from "../utils/weeklyDigest";
import { setupQuickActions, getInitialQuickAction, addQuickActionListener } from "../utils/quickActions";
import { ThemeProvider, useTheme } from "../utils/theme";
import { AuthProvider, useAuth } from "../contexts/AuthContext";

// Native (static) splash tab tak dikhi rahegi jab tak font load na ho jaye -
// isse animated splash par text bina font ke fleeting flash nahi hoti.
SplashScreen.preventAutoHideAsync().catch(() => {});

// Module scope par ek hi baar chalta hai (component re-render hone par dobara nahi).
configureNotificationHandler();
configureNotificationCategories();

// User notification par "Remind Tomorrow" dabata hai - naya reminder schedule
// karke payment record ka notificationId update karte hain, taake baad mein
// (paid/delete par) sahi notification cancel ho.
async function handleNotificationResponse(response) {
  if (response.actionIdentifier !== REMIND_TOMORROW_ACTION) return;
  const paymentId = response.notification.request.content.data?.paymentId;
  if (!paymentId) return;

  const payments = await getPayments();
  const payment = payments.find((p) => p.id === paymentId);
  if (!payment) return;

  const notificationId = await snoozePaymentReminderToTomorrow(payment);
  await updatePayment(payment.id, { notificationId });
}

// App background se wapis foreground mein aayi to check karte hain: kya
// user abhi "Open App" se kisi provider ki app pe gaya tha? Agar haan aur
// wo payment abhi bhi unpaid hai, to seedha pooch lete hain - taake user ko
// khud dhoondh kar swipe karne ki zaroorat na pade.
async function checkRecentlyOpenedPayment() {
  const paymentId = consumeRecentlyOpenedPayment();
  if (!paymentId) return;

  const payments = await getPayments();
  const payment = payments.find((p) => p.id === paymentId);
  if (!payment || payment.isPaid) return;

  Alert.alert(
    "Complete this payment?",
    `Did you finish paying "${payment.title}"?`,
    [
      { text: "Not Yet", style: "cancel" },
      {
        text: "Yes, Mark as Paid",
        onPress: () => markPaymentPaid(payment),
      },
    ]
  );
}

// Face ID/fingerprint se unlock hone tak app ka content bilkul nahi dikhta -
// sirf yeh lock screen. Mount hote hi khud-ba-khud biometric prompt trigger
// karte hain, taake user ko manually button dabana na pade.
function LockScreen({ theme, onUnlock }) {
  const [checking, setChecking] = useState(false);

  async function attemptUnlock() {
    setChecking(true);
    const success = await authenticateWithBiometrics();
    setChecking(false);
    if (success) onUnlock();
  }

  useEffect(() => {
    attemptUnlock();
  }, []);

  return (
    <View style={[lockStyles.container, { backgroundColor: theme.background }]}>
      <View style={[lockStyles.iconBadge, { backgroundColor: theme.primarySoft }]}>
        <Ionicons name="lock-closed" size={32} color={theme.primary} />
      </View>
      <Text style={[lockStyles.title, { color: theme.text }]}>Reminds Me is Locked</Text>
      <Text style={[lockStyles.subtitle, { color: theme.textSecondary }]}>
        Unlock with Face ID or fingerprint to continue.
      </Text>
      <TouchableOpacity
        style={[lockStyles.button, { backgroundColor: theme.primary }]}
        onPress={attemptUnlock}
        disabled={checking}
      >
        <Text style={lockStyles.buttonText}>{checking ? "Checking..." : "Unlock"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const lockStyles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  iconBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: { fontSize: 20, fontWeight: "700" },
  subtitle: { fontSize: 14, marginTop: 8, marginBottom: 28, textAlign: "center" },
  button: { paddingVertical: 14, paddingHorizontal: 36, borderRadius: 10 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});

function AppContent({ theme, fontsLoaded }) {
  const { initializing } = useAuth();
  const router = useRouter();
  const ready = fontsLoaded && !initializing;
  // null = abhi tak AsyncStorage se lock preference check nahi hui.
  const [lockEnabled, setLockEnabled] = useState(null);
  const [locked, setLocked] = useState(false);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    isAppLockEnabled().then((enabled) => {
      setLockEnabled(enabled);
      setLocked(enabled);
    });
  }, []);

  // App background se wapis foreground mein aaye to dobara lock kar dete hain
  // (agar feature on hai) - taake koi bhi phone uthate hi payments na dekh sake.
  // Isi transition par yeh bhi check karte hain ke kya user "Open App" se
  // kisi provider ki app pe gaya tha - agar haan to payment confirm karwate hain.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (
        appState.current.match(/active/) &&
        nextState.match(/inactive|background/) &&
        lockEnabled
      ) {
        setLocked(true);
      }
      if (appState.current.match(/inactive|background/) && nextState === "active") {
        checkRecentlyOpenedPayment();
        scheduleWeeklyDigest();
      }
      appState.current = nextState;
    });
    return () => subscription.remove();
  }, [lockEnabled]);

  // App icon ka "Add Payment" shortcut register karte hain, aur agar app hi
  // usi shortcut se khuli ho (cold start) ya user ne warm app mein dabaya ho,
  // to seedha add-payment screen par navigate kar dete hain. "ready" hone tak
  // rukte hain taake Stack navigator mount ho chuka ho.
  useEffect(() => {
    if (!ready) return;
    setupQuickActions();
    scheduleWeeklyDigest();

    const initialAction = getInitialQuickAction();
    if (initialAction?.params?.href) {
      router.push(initialAction.params.href);
    }

    const subscription = addQuickActionListener((action) => {
      if (action?.params?.href) {
        router.push(action.params.href);
      }
    });
    return () => subscription.remove();
  }, [ready]);

  useEffect(() => {
    if (ready && lockEnabled !== null) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [ready, lockEnabled]);

  // Jab tak font load na ho AUR Firebase yeh confirm na kar de ke pehle se
  // koi login session hai ya nahi, kuch bhi render nahi karte - native splash
  // hi dikhti rehti hai. Isse addPayment/getPayments jaise calls kabhi bhi
  // stale "logged out" state dekh kar galti se local storage use nahi karte.
  if (!ready || lockEnabled === null) return null;

  if (locked) {
    return (
      <SafeAreaProvider style={{ backgroundColor: theme.background }}>
        <StatusBar style={theme.mode === "dark" ? "light" : "dark"} />
        <LockScreen theme={theme} onUnlock={() => setLocked(false)} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider style={{ backgroundColor: theme.background }}>
      <StatusBar style={theme.mode === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.surface },
          headerTintColor: theme.text,
          headerTitleStyle: { color: theme.text },
          contentStyle: { backgroundColor: theme.background },
          // Back button ke sath pichli screen ka route-name (jaise "(tabs)") label ban
          // kar na aaye - sirf chevron dikhna chahiye.
          headerBackTitle: "",
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="choose-payment-type"
          options={{ title: "New Reminder", presentation: "modal" }}
        />
        <Stack.Screen
          name="add-payment"
          options={{ title: "Add Payment", presentation: "modal" }}
        />
        <Stack.Screen
          name="add-shared-bill"
          options={{ title: "Split a Bill", presentation: "modal" }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}

function ThemedApp({ fontsLoaded }) {
  const theme = useTheme();
  return <AppContent theme={theme} fontsLoaded={fontsLoaded} />;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Pacifico_400Regular, Quicksand_700Bold });

  useEffect(() => {
    requestNotificationPermissions();

    if (Platform.OS === "web") return;
    const subscription = Notifications.addNotificationResponseReceivedListener(
      handleNotificationResponse
    );
    return () => subscription.remove();
  }, []);

  // Ads sirf custom dev build/production mein kaam karte hain (Expo Go mein
  // native ad SDK bundled nahi hota, aur web par bilkul support hi nahi hai).
  // Asal risky import "utils/initAds.js" mein hai, jiska "utils/initAds.web.js"
  // wala safe version web build ke liye khud-ba-khud use hota hai.
  useEffect(() => {
    if (!adsSupported) return;
    initAds();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AuthProvider>
          <ThemedApp fontsLoaded={fontsLoaded} />
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
