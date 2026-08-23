import { Platform } from "react-native";
import Constants from "expo-constants";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

const STORE_URLS = {
  ios: "https://apps.apple.com/app/id6802544860",
  android: "https://play.google.com/store/apps/details?id=com.sheikhgroup.remindsme",
};

// "1.0.10" vs "1.0.9" jese cases bhi sahi handle karta hai - string compare
// (">") isay ghalat karega, is liye har part ko number bana kar compare karte hain.
function isNewer(remote, current) {
  const a = remote.split(".").map(Number);
  const b = current.split(".").map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const na = a[i] ?? 0;
    const nb = b[i] ?? 0;
    if (na !== nb) return na > nb;
  }
  return false;
}

// App khulte hi ek dafa check karta hai: Firestore ke "appConfig/version" doc
// mein is platform ka "latest" version, humari installed version se naya hai
// ya nahi. Ye document sirf Firebase Console/Admin SDK se likha ja sakta hai
// (security rules mein client write allow nahi) - har naye store release ke
// baad ise manually update karna hota hai taake existing users ko pata chale.
export async function checkForUpdate() {
  if (Platform.OS === "web") return null;
  try {
    const snap = await getDoc(doc(db, "appConfig", "version"));
    if (!snap.exists()) return null;

    const data = snap.data();
    const latest = Platform.OS === "ios" ? data.latestIOS : data.latestAndroid;
    const current = Constants.expoConfig?.version;
    if (!latest || !current) return null;

    if (isNewer(latest, current)) {
      return { latestVersion: latest, storeUrl: STORE_URLS[Platform.OS] };
    }
    return null;
  } catch {
    // Network issue ya doc na hona - chup chaap ignore, app normal chalti rahe.
    return null;
  }
}
