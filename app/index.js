import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "../utils/theme";

const NAVIGATE_AFTER_MS = 3500;
// Title+subtitle block ki reserved height ka taqreeban aadha - logo ko itna
// neeche se shuru karte hain taake pop-in ke waqt wo screen ke bilkul true
// center mein dikhe (text abhi invisible hai lekin layout mein apni jagah
// reserve kiye hue hai). Yeh sirf initial "center" position ke liye hai -
// isse chhero mat, warna logo center mein pop nahi hoga.
const LOGO_CENTER_OFFSET = 42;
// Pop-in ke baad logo apni "center" wali jagah se itna upar slide karta hai -
// jitna zyada, utna hi zyada upar center se above jaake rukta hai. Yeh
// LOGO_CENTER_OFFSET se alag hai isliye logo hamesha center mein hi pop hoga,
// phir wahin se upar jayega (neeche se center mein aata hua nahi dikhega).
const LOGO_SLIDE_DISTANCE = 180;

export default function SplashIntroScreen() {
  const router = useRouter();
  const theme = useTheme();
  const logoScale = useRef(new Animated.Value(0)).current;
  const logoTranslateY = useRef(new Animated.Value(LOGO_CENTER_OFFSET)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const poweredOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      // Logo pehle screen ke center mein "pop" hoke aata hai (bouncy scale-in).
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 4,
        tension: 55,
        useNativeDriver: true,
      }),
      // Phir logo apni center wali jagah se upar slide hota hai taake neeche
      // text ke liye jagah bane.
      Animated.timing(logoTranslateY, {
        toValue: LOGO_CENTER_OFFSET - LOGO_SLIDE_DISTANCE,
        duration: 450,
        useNativeDriver: true,
      }),
      // Ab neeche "Reminds Me" / "Never Miss Your Payments" text fade-in hota hai.
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      // Sabse aakhir mein "Powered by" footer fade-in hota hai.
      Animated.timing(poweredOpacity, {
        toValue: 1,
        duration: 400,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      router.replace("/dashboard");
    }, NAVIGATE_AFTER_MS);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Logo aur uske neeche wala text ek hi group ke taur par slide karte
          hain, taake text hamesha logo ke bilkul neeche hi rahe (upar sirf
          logo akela move ho to donon ke beech gap ban jata hai). */}
      <Animated.View style={[styles.logoTextGroup, { transform: [{ translateY: logoTranslateY }] }]}>
        <Animated.Image
          source={require("../assets/logo.png")}
          style={[styles.logo, { transform: [{ scale: logoScale }] }]}
        />
        <Animated.Text
          style={[styles.title, { opacity: textOpacity, color: theme.primary }]}
        >
          Reminds Me
        </Animated.Text>
        <Animated.Text
          style={[styles.subtitle, { opacity: textOpacity, color: theme.textSecondary }]}
        >
          Never Miss Your Payments
        </Animated.Text>
      </Animated.View>

      <Animated.View style={[styles.poweredRow, { opacity: poweredOpacity }]}>
        <Animated.Image
          source={require("../assets/powered-by-logo.jpeg")}
          style={styles.poweredLogo}
        />
        <Animated.Text style={[styles.poweredText, { color: theme.textSecondary }]}>
          POWERED BY SHEIKH GROUP
        </Animated.Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  logoTextGroup: {
    alignItems: "center",
  },
  logo: {
    width: 140,
    height: 140,
    borderRadius: 28,
    overflow: "hidden",
  },
  title: {
    marginTop: 20,
    fontSize: 36,
    fontFamily: "Pacifico_400Regular",
  },
  subtitle: {
    marginTop: 6,
    fontSize: 13,
  },
  poweredRow: {
    position: "absolute",
    bottom: 70,
    flexDirection: "row",
    alignItems: "center",
  },
  poweredLogo: {
    width: 26,
    height: 26,
    borderRadius: 5,
    marginRight: 7,
  },
  poweredText: {
    fontSize: 14,
    fontWeight: "500",
  },
});
