import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";

// Expo Go mein native ad SDK bundled nahi hota - is liye ads sirf ek
// "custom dev build" (EAS Build) ya production build mein hi kaam karte hain.
// Poore codebase mein "react-native-google-mobile-ads" ko sirf tab import/require
// karna hai jab yeh true ho, warna Expo Go poori app crash kar degi (us package
// ka native module wrapper import hote hi turant native binding dhoondta hai).
export const adsSupported =
  Platform.OS !== "web" && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

// Google ke official, publicly documented TEST banner ad unit IDs - hamesha
// kaam karte hain, koi real AdMob account nahi chahiye. Docs:
// https://developers.google.com/admob/ios/test-ads
const TEST_BANNER_UNIT_ID = {
  ios: "ca-app-pub-3940256099942544/2934735716",
  android: "ca-app-pub-3940256099942544/6300978111",
};

// Real banner ad units - AdMob console se liye gaye.
const REAL_IOS_BANNER_UNIT_ID = "ca-app-pub-7606267073452752/5592441285";
const REAL_ANDROID_BANNER_UNIT_ID = "ca-app-pub-7606267073452752/9482798410";

const REAL_BANNER_UNIT_ID = {
  ios: REAL_IOS_BANNER_UNIT_ID,
  android: REAL_ANDROID_BANNER_UNIT_ID,
};

// Development build mein hamesha test ad dikhate hain - taake apne banaye
// hue AdMob account par galti se invalid clicks/impressions na jayein jab
// tak app publish na ho jaye.
export function getBannerAdUnitId() {
  if (__DEV__) {
    return TEST_BANNER_UNIT_ID[Platform.OS] ?? TEST_BANNER_UNIT_ID.android;
  }
  return REAL_BANNER_UNIT_ID[Platform.OS] ?? REAL_BANNER_UNIT_ID.android;
}
