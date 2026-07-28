import AsyncStorage from "@react-native-async-storage/async-storage";

const VIEW_MODE_KEY = "paymentsViewMode";

// Payments tab "List" (payment cards) dikhaye ya "Calendar" - yeh Profile
// tab se set hoti hai (device-level setting hai, koi account cloud sync
// nahi). Default hamesha "list" hai.
export async function getDefaultViewMode() {
  const value = await AsyncStorage.getItem(VIEW_MODE_KEY);
  return value === "calendar" ? "calendar" : "list";
}

export async function setDefaultViewMode(mode) {
  await AsyncStorage.setItem(VIEW_MODE_KEY, mode);
}
