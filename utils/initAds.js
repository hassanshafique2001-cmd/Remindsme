// Web ke liye alag "initAds.web.js" file hai (koi native ad module import
// nahi karti) - taake Metro bundling ke waqt bhi is native-only package ko
// web ke liye kabhi resolve na kiya jaye (warna poori app bundling error se
// crash ho jati hai, chahe yeh call kabhi run na ho).
export function initAds() {
  const mobileAds = require("react-native-google-mobile-ads").default;
  mobileAds().initialize();
}
