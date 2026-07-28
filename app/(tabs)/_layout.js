import { useEffect, useState } from "react";
import { Dimensions, Image, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Tabs, usePathname } from "expo-router";
import { useTheme, withAlpha } from "../../utils/theme";
import { useAuth } from "../../contexts/AuthContext";
import { hasSeenSignupNudge, markSignupNudgeSeen } from "../../utils/onboarding";
import { hasSeenTutorial, markTutorialSeen } from "../../utils/tutorial";

// Har tab ka apna accent - active tab ka icon/label isi color mein highlight
// hota hai (tabBarActiveTintColor), taake bottom bar khud bhi colorful lage.
const TAB_ACCENTS = {
  dashboard: "#2563eb",
  payments: "#2e7d32",
  shared: "#F59E0B",
  profile: "#EC4899",
};

// Pehli dafa app khulne par 4-step walkthrough - har step ek bottom tab ko
// explain karta hai, isi tarteeb mein jis tarteeb mein tabs bar mein hain.
const TUTORIAL_STEPS = [
  {
    icon: "bar-chart-outline",
    color: TAB_ACCENTS.dashboard,
    title: "Dashboard",
    description:
      "See your spending at a glance - upcoming totals, payment score, spending trends, and how much you're owed or owe others.",
  },
  {
    icon: "wallet-outline",
    color: TAB_ACCENTS.payments,
    title: "Payments",
    description:
      "Add bills, subscriptions, and reminders here. Switch between list and calendar view, and track money you lend or borrow in the Ledger.",
  },
  {
    icon: "people-outline",
    color: TAB_ACCENTS.shared,
    title: "Shared",
    description:
      "Split bills with roommates or family - everyone sees their share and can mark it paid.",
  },
  {
    icon: "person-outline",
    color: TAB_ACCENTS.profile,
    title: "Profile",
    description:
      "Sign in to sync across devices, set up an app lock, pick your theme, and back up your data.",
  },
];

// Har step ke corresponding tab (Dashboard/Payments/Shared/Profile) ke bilkul
// upar arrow point karne ke liye uska horizontal center nikalta hai - 4 tabs
// screen ki width mein barabar phaili hoti hain.
function getTabCenterX(index) {
  const screenWidth = Dimensions.get("window").width;
  return (screenWidth / TUTORIAL_STEPS.length) * (index + 0.5);
}

const ARROW_HALF_WIDTH = 10;

function PaymentsHeaderTitle({ theme }) {
  return (
    <View style={styles.headerTitleRow}>
      <Image source={require("../../assets/logo.png")} style={styles.headerLogo} />
      <Text style={[styles.headerTitleText, { color: theme.primary }]}>Reminds Me</Text>
    </View>
  );
}

// Pehle ek padded "pill" View mein wrap kiya tha jo tab bar ke fixed icon-slot
// se bari nikal kar clip ho rahi thi (icon ghayab, sirf label bachta tha).
// Ab sirf icon size/color seedha pass karte hain - koi extra wrapper nahi,
// taake tab bar ka apna layout kabhi na tootay. Rang ab bhi har tab ka apna
// hai (tabBarActiveTintColor se), bas peeche koi pill background nahi.
function TabIcon({ name, size, color }) {
  return <Ionicons name={name} size={size} color={color} />;
}

// Sirf ek dafa, sabse pehle app-open par (SignupNudge se bhi pehle) dikhta
// hai - har bottom tab ka ek step, "Skip" kabhi bhi poora tutorial khatam kar
// deta hai, "Got It" agle step par le jata hai (aakhri par "Get Started").
function AppTutorial({ onFinish, theme }) {
  const [step, setStep] = useState(0);
  const current = TUTORIAL_STEPS[step];
  const isLast = step === TUTORIAL_STEPS.length - 1;

  function handleNext() {
    if (isLast) {
      onFinish();
    } else {
      setStep((s) => s + 1);
    }
  }

  // Arrow ka horizontal center us tab ke seedha upar hona chahiye jiski baat
  // ho rahi hai - taake user ko pata chale ke card kis tab ko explain kar raha hai.
  const arrowLeft = getTabCenterX(step) - ARROW_HALF_WIDTH;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onFinish}>
      <View style={tutorialStyles.overlay}>
        <View style={[tutorialStyles.card, { backgroundColor: theme.surface }]}>
          <View style={tutorialStyles.topRow}>
            <Text style={[tutorialStyles.stepCounter, { color: theme.textSecondary }]}>
              {step + 1}/{TUTORIAL_STEPS.length}
            </Text>
            <TouchableOpacity onPress={onFinish} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={[tutorialStyles.skipText, { color: theme.textSecondary }]}>Skip</Text>
            </TouchableOpacity>
          </View>

          <View
            style={[
              tutorialStyles.iconBadge,
              { backgroundColor: withAlpha(current.color, theme.mode === "dark" ? 0.22 : 0.14) },
            ]}
          >
            <Ionicons name={current.icon} size={40} color={current.color} />
          </View>

          <Text style={[tutorialStyles.title, { color: theme.text }]}>{current.title}</Text>
          <Text style={[tutorialStyles.description, { color: theme.textSecondary }]}>
            {current.description}
          </Text>

          <View style={tutorialStyles.dotsRow}>
            {TUTORIAL_STEPS.map((_, i) => (
              <View
                key={i}
                style={[
                  tutorialStyles.dot,
                  { backgroundColor: i === step ? current.color : theme.border },
                ]}
              />
            ))}
          </View>

          <TouchableOpacity
            style={[tutorialStyles.gotItButton, { backgroundColor: current.color }]}
            onPress={handleNext}
          >
            <Text style={tutorialStyles.gotItButtonText}>{isLast ? "Get Started" : "Got It"}</Text>
          </TouchableOpacity>
        </View>

        <View style={[tutorialStyles.arrowDown, { left: arrowLeft, borderTopColor: current.color }]} />
      </View>
    </Modal>
  );
}

// Sirf ek dafa, fresh install ke pehle app-open par (aur sirf guest ke liye)
// dikhta hai - Profile tab ki taraf ishara karta hai taake user samajh jaye
// ke apna data mehfooz karne ke liye yahan se sign in kar sakta hai.
function SignupNudge({ onDismiss, theme }) {
  return (
    <View style={nudgeStyles.wrapper} pointerEvents="box-none">
      <View style={[nudgeStyles.card, { backgroundColor: theme.primary }]}>
        <TouchableOpacity
          style={nudgeStyles.closeButton}
          onPress={onDismiss}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={16} color="#fff" />
        </TouchableOpacity>
        <Text style={nudgeStyles.title}>Don't lose your data!</Text>
        <Text style={nudgeStyles.subtitle}>
          Sign in from Profile to keep your payments safe if you ever reinstall.
        </Text>
      </View>
      <View style={[nudgeStyles.arrow, { borderTopColor: theme.primary }]} />
    </View>
  );
}

export default function TabsLayout() {
  const theme = useTheme();
  const { user } = useAuth();
  const pathname = usePathname();
  const [showNudge, setShowNudge] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  // Jab tak yeh true na ho, tutorial ka async AsyncStorage check abhi pending
  // hai - nudge ka apna check isi par rukta hai (warna dono ek sath, race
  // condition ki wajah se, ek hi waqt par screen par aa jate hain).
  const [tutorialChecked, setTutorialChecked] = useState(false);

  useEffect(() => {
    hasSeenTutorial().then((seen) => {
      if (!seen) setShowTutorial(true);
      setTutorialChecked(true);
    });
  }, []);

  function finishTutorial() {
    setShowTutorial(false);
    markTutorialSeen();
  }

  // Tutorial khatam hone tak nudge ko rok kar rakhte hain - taake ek dafa
  // mein sirf ek hi onboarding cheez screen par ho.
  useEffect(() => {
    if (!tutorialChecked || showTutorial || user) return;
    hasSeenSignupNudge().then((seen) => {
      if (!seen) setShowNudge(true);
    });
  }, [user, showTutorial, tutorialChecked]);

  function dismissNudge() {
    setShowNudge(false);
    markSignupNudgeSeen();
  }

  // User Profile tab par khud pahunch gaya - ab nudge ki zaroorat nahi.
  useEffect(() => {
    if (showNudge && pathname === "/profile") {
      dismissNudge();
    }
  }, [pathname, showNudge]);

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: theme.surface },
          headerTintColor: theme.text,
          tabBarStyle: { backgroundColor: theme.surface, borderTopColor: theme.border },
          tabBarInactiveTintColor: theme.textMuted,
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{
            title: "Dashboard",
            tabBarActiveTintColor: TAB_ACCENTS.dashboard,
            tabBarIcon: ({ size, color }) => (
              <TabIcon name="bar-chart-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="payments"
          options={{
            headerTitle: () => <PaymentsHeaderTitle theme={theme} />,
            headerTitleAlign: "center",
            tabBarLabel: "Payments",
            tabBarActiveTintColor: TAB_ACCENTS.payments,
            tabBarIcon: ({ size, color }) => (
              <TabIcon name="wallet-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="shared"
          options={{
            title: "Shared",
            tabBarActiveTintColor: TAB_ACCENTS.shared,
            tabBarIcon: ({ size, color }) => (
              <TabIcon name="people-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarActiveTintColor: TAB_ACCENTS.profile,
            tabBarIcon: ({ size, color }) => (
              <TabIcon name="person-outline" size={size} color={color} />
            ),
          }}
        />
      </Tabs>

      {showNudge && <SignupNudge onDismiss={dismissNudge} theme={theme} />}
      {showTutorial && <AppTutorial onFinish={finishTutorial} theme={theme} />}
    </View>
  );
}

const styles = StyleSheet.create({
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerLogo: {
    width: 26,
    height: 26,
    borderRadius: 6,
    marginRight: 8,
  },
  headerTitleText: {
    fontFamily: "Quicksand_700Bold",
    fontSize: 20,
  },
});

const nudgeStyles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    right: 8,
    bottom: 78,
    alignItems: "flex-end",
  },
  card: {
    width: 220,
    borderRadius: 14,
    padding: 14,
    paddingRight: 26,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  closeButton: {
    position: "absolute",
    top: 8,
    right: 8,
  },
  title: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  subtitle: {
    color: "#fff",
    fontSize: 12,
    lineHeight: 17,
  },
  arrow: {
    marginRight: 28,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
});

const tutorialStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    // Card ko neeche, tab bar ke qareeb rakhte hain (bilkul center mein nahi) -
    // taake neeche wala arrow aur asal tab bar ek nazar mein connected lagein.
    justifyContent: "flex-end",
    paddingHorizontal: 24,
    paddingBottom: 100,
  },
  // Card ke bilkul neeche, tab bar ke thora upar - horizontal position har
  // step par us tab ke seedha upar dynamically move hoti hai.
  arrowDown: {
    position: "absolute",
    bottom: 58,
    width: 0,
    height: 0,
    borderLeftWidth: ARROW_HALF_WIDTH,
    borderRightWidth: ARROW_HALF_WIDTH,
    borderTopWidth: 14,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
  card: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginBottom: 8,
  },
  stepCounter: {
    fontSize: 13,
    fontWeight: "700",
  },
  skipText: {
    fontSize: 14,
    fontWeight: "600",
  },
  iconBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 10,
  },
  description: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginBottom: 22,
  },
  dotsRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 22,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  gotItButton: {
    width: "100%",
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
  },
  gotItButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
