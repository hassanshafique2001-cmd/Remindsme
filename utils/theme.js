import { createContext, useContext, useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const lightColors = {
  mode: "light",
  background: "#f2f2f2",
  surface: "#ffffff",
  text: "#1c1c1e",
  textSecondary: "#777777",
  textMuted: "#999999",
  border: "#dddddd",
  primary: "#2e7d32",
  primarySoft: "#e8f5e9",
  danger: "#d32f2f",
  dangerSoft: "#fdecea",
  // "Due soon lekin abhi overdue nahi" ke liye amber - danger (red) sirf
  // sach mein overdue payments ke liye reserve rehta hai.
  warning: "#c77700",
  warningSoft: "#fff2df",
  // Generic "info" accent (blue) - jab kisi cheez ka koi specific category
  // nahi hoti (jaise "Total Upcoming" jaisa overall summary) lekin phir bhi
  // ek soft colored background chahiye hota hai.
  info: "#2563eb",
  infoSoft: "#e0ebfd",
};

export const darkColors = {
  mode: "dark",
  background: "#121212",
  surface: "#1e1e1e",
  text: "#f2f2f2",
  textSecondary: "#aaaaaa",
  textMuted: "#888888",
  border: "#3a3a3c",
  primary: "#4caf50",
  primarySoft: "#1e3a20",
  danger: "#ef5350",
  dangerSoft: "#3a2222",
  warning: "#f0a020",
  warningSoft: "#3a2e14",
  info: "#5b9bf7",
  infoSoft: "#1c2b47",
};

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
