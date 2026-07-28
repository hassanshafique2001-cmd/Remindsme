import AsyncStorage from "@react-native-async-storage/async-storage";

const SEEN_KEY = "hasSeenSignupNudge";

// Fresh install par yeh key AsyncStorage mein maujood nahi hoti (uninstall
// karne se AsyncStorage bhi khatam ho jata hai) - isi liye yeh naturally
// "sirf pehli dafa" ka kaam karta hai, koi alag install-tracking nahi chahiye.
export async function hasSeenSignupNudge() {
  const value = await AsyncStorage.getItem(SEEN_KEY);
  return value === "true";
}

export async function markSignupNudgeSeen() {
  await AsyncStorage.setItem(SEEN_KEY, "true");
}
