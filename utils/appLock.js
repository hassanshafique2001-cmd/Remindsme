import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";

const LOCK_ENABLED_KEY = "appLockEnabled";

export async function isAppLockEnabled() {
  if (Platform.OS === "web") return false;
  const value = await AsyncStorage.getItem(LOCK_ENABLED_KEY);
  return value === "true";
}

export async function setAppLockEnabled(enabled) {
  await AsyncStorage.setItem(LOCK_ENABLED_KEY, enabled ? "true" : "false");
}

// Device par Face ID/fingerprint/PIN hardware AUR enrollment dono check karta
// hai - agar user ne apne phone par kuch bhi set up nahi kiya to lock ka
// option offer nahi karna chahiye (warna toggle on karke bhi kabhi unlock
// nahi ho payega).
export async function isDeviceLockAvailable() {
  if (Platform.OS === "web") return false;
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  return hasHardware && isEnrolled;
}

// disableDeviceFallback: false - Face ID/fingerprint fail hone par device ka
// apna PIN/password bhi bataur fallback chal jata hai (jaisa baaki apps mein hota hai).
export async function authenticateWithBiometrics() {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: "Unlock Reminds Me",
    cancelLabel: "Cancel",
    disableDeviceFallback: false,
  });
  return result.success;
}
