import { Platform } from "react-native";
import Constants from "expo-constants";

const IOS_APP_ID = "6802544860";
const ANDROID_PACKAGE_ID = "com.sheikhgroup.remindsme";

const STORE_URLS = {
  ios: `https://apps.apple.com/app/id${IOS_APP_ID}`,
  android: `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE_ID}`,
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

// Apple ka official, public "iTunes Lookup" API - koi credentials nahi chahiye,
// seedha wahi version deta hai jo abhi App Store pe live hai.
async function fetchLiveIOSVersion() {
  const res = await fetch(`https://itunes.apple.com/lookup?id=${IOS_APP_ID}`);
  const json = await res.json();
  return json?.results?.[0]?.version ?? null;
}

// Google ka koi credential-free public version-lookup API nahi hai, is liye
// public store listing page se hi nikalte hain (wahi jagah jahan yeh number
// khud dikhta hai). Agar Google kabhi page ka structure badal de aur pattern
// match na ho, checkForUpdate chup chaap null return kar deta hai (feature
// silently skip ho jati hai, app crash nahi hoti).
async function fetchLiveAndroidVersion() {
  const res = await fetch(
    `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE_ID}&hl=en&gl=US`
  );
  const html = await res.text();
  const match = html.match(/\[\[\["(\d+\.\d+(?:\.\d+)?)"\]\]/);
  return match ? match[1] : null;
}

// App khulte hi ek dafa check karta hai: jo version abhi App Store/Play Store
// pe genuinely LIVE hai, humari installed version se naya hai ya nahi. Kisi
// bhi manual "har release ke baad kahin update karo" step ki zaroorat nahi -
// seedha real store se live padhta hai.
export async function checkForUpdate() {
  if (Platform.OS === "web") return null;
  try {
    const current = Constants.expoConfig?.version;
    if (!current) return null;

    const latest =
      Platform.OS === "ios" ? await fetchLiveIOSVersion() : await fetchLiveAndroidVersion();
    if (!latest) return null;

    if (isNewer(latest, current)) {
      return { latestVersion: latest, storeUrl: STORE_URLS[Platform.OS] };
    }
    return null;
  } catch {
    // Network issue ya store page/API na milna - chup chaap ignore, app normal chalti rahe.
    return null;
  }
}
