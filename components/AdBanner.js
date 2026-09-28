import { StyleSheet, View } from "react-native";
import { adsSupported, getBannerAdUnitId } from "../utils/ads";

// "react-native-google-mobile-ads" ko sirf yahan, aur sirf tab require karte
// hain jab yeh platform/build ads support karta ho. Agar yeh file ke top par
// normal "import" hoti to Expo Go mein poori app crash ho jati - us package
// ka native module wrapper import hote hi turant native binding dhoondta hai
// aur na milne par error throw karta hai. try/catch mein wrap kiya hai taake
// native linking kabhi fail ho to poori screen crash na ho, sirf ad na dikhe.
let BannerAd = null;
let BannerAdSize = null;
if (adsSupported) {
  try {
    const googleMobileAds = require("react-native-google-mobile-ads");
    BannerAd = googleMobileAds.BannerAd;
    BannerAdSize = googleMobileAds.BannerAdSize;
  } catch {
    // native module link nahi ho paya - AdBanner khamoshi se kuch nahi dikhayega.
  }
}

// Payments tab ke bottom mein FAB se upar lagta hai. Expo Go ya web par
// bilkul kuch render nahi karta (adsSupported false hoga).
export function AdBanner() {
  if (!adsSupported || !BannerAd) return null;

  return (
    <View style={styles.container}>
      <BannerAd
        unitId={getBannerAdUnitId()}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: 4,
  },
});
