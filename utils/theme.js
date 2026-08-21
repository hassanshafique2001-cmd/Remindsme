import { createContext, useContext, useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Premium warm palette inspired by the app's bell logo (pink/coral/peach/
// purple gradient with a mint-green money badge). "primary"/"danger"/etc.
// keep their existing semantic meaning (primary = positive/success,
// unchanged everywhere it's already used) - only the actual hex values and
// the background/surface/text warmth changed, plus new "brand*"/"gradient*"
// tokens were added for the new premium accents (FAB, primary CTAs, active
// tab, splash glow) so no existing call site's meaning silently shifted.
export const lightColors = {
  mode: "light",
  background: "#FBF5F1",
  surface: "#FFFFFF",
  surfaceSoft: "#FDF1EC",
  text: "#2B2230",
  textSecondary: "#7C6E76",
  textMuted: "#AFA3AA",
  border: "#F0E2E6",
  primary: "#2E9E5B",
  primarySoft: "#E3F5EB",
  danger: "#E1483F",
  dangerSoft: "#FBE9E7",
  // "Due soon lekin abhi overdue nahi" ke liye amber - danger (red) sirf
  // sach mein overdue payments ke liye reserve rehta hai.
  warning: "#E08A2C",
  warningSoft: "#FDF0DE",
  // Generic "info" accent - jab kisi cheez ka koi specific category nahi
  // hoti (jaise "Total Upcoming" jaisa overall summary) lekin phir bhi ek
  // soft colored background chahiye hota hai. Brand purple family se liya
  // hai taake dashboard ka overall accent bhi brand identity se juda rahe.
  info: "#7C6FE0",
  infoSoft: "#ECE9FB",
  // Brand accents - logo ke pink/coral/peach/purple se, sirf naye premium
  // treatments (buttons, FAB, active tab, splash glow) ke liye use hote hain.
  brandPink: "#E85D9E",
  brandCoral: "#F27C8D",
  brandPeach: "#FFAD86",
  brandOrange: "#F6A84A",
  brandPurple: "#8E6CE8",
  brandPurpleDeep: "#6D4CC7",
  gradientStart: "#F2709C",
  gradientEnd: "#8E6CE8",
};

export const darkColors = {
  mode: "dark",
  background: "#17121F",
  surface: "#211B2C",
  surfaceSoft: "#1C1725",
  text: "#F5EFF2",
  textSecondary: "#B8ACB5",
  textMuted: "#8B7F87",
  border: "#342C3E",
  primary: "#4ADE94",
  primarySoft: "#1E3A2C",
  danger: "#FF6B6B",
  dangerSoft: "#3A2429",
  warning: "#FFB454",
  warningSoft: "#3A2E1C",
  info: "#A78BFA",
  infoSoft: "#2A2440",
  brandPink: "#F472B6",
  brandCoral: "#FB92A0",
  brandPeach: "#FFC199",
  brandOrange: "#FFC069",
  brandPurple: "#A78BFA",
  brandPurpleDeep: "#8B6FE0",
  gradientStart: "#F472B6",
  gradientEnd: "#A78BFA",
};

// Global type scale - naming se hi role clear hai, taake screens random
// font-size na chunein. Sirf sizes/weights hain, theme-mode se independent.
export const typeScale = {
  display: { fontSize: 32, fontWeight: "700" },
  screenTitle: { fontSize: 22, fontWeight: "700" },
  sectionTitle: { fontSize: 15, fontWeight: "700" },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  body: { fontSize: 14, fontWeight: "500" },
  bodySmall: { fontSize: 13, fontWeight: "500" },
  caption: { fontSize: 12, fontWeight: "600" },
  microLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.4 },
  button: { fontSize: 15, fontWeight: "700" },
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 };

// Hex color ko rgba() mein convert karta hai - category badges/chips ke
// "soft" background banane ke liye (solid category color ka halka sa tint,
// bina har category ke liye alag light/dark hex likhe).
export function withAlpha(hex, alpha) {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const THEME_PREF_KEY = "themePreference";

const ThemeContext = createContext(null);

// Poori app ki theme yahin se control hoti hai. "auto" (default) system ke
// dark/light mode ko follow karta hai; "light"/"dark" user ka manual choice
// hai jo AsyncStorage mein persist hoti hai aur system se override ho jati hai.
export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState("auto");

  useEffect(() => {
    AsyncStorage.getItem(THEME_PREF_KEY).then((value) => {
      if (value === "light" || value === "dark") setPreferenceState(value);
    });
  }, []);

  async function setPreference(next) {
    setPreferenceState(next);
    await AsyncStorage.setItem(THEME_PREF_KEY, next);
  }

  const resolvedMode = preference === "auto" ? (systemScheme === "dark" ? "dark" : "light") : preference;
  const colors = resolvedMode === "dark" ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ colors, preference, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

// Existing call sites `const theme = useTheme()` expect colors seedha milen -
// isliye yeh hook wahi purana shape return karta hai, sirf ab context-backed hai.
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx.colors;
}

// Sirf Profile screen ke theme-picker UI ke liye - current preference aur
// usay badalne wala function deta hai.
export function useThemePreference() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useThemePreference must be used within a ThemeProvider");
  return { preference: ctx.preference, setPreference: ctx.setPreference };
}
