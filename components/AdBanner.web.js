// Web ke liye alag file hai (Metro/bundler khud isay .js ki jagah use karta
// hai jab platform=web ho) - taake native-only "react-native-google-mobile-ads"
// package bundling ke waqt bhi kabhi web ke liye resolve na ho. Web par ads
// support hi nahi hain (utils/ads.js mein adsSupported hamesha false hota hai).
export function AdBanner() {
  return null;
}
