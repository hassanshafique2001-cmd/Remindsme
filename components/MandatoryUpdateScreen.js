import { Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

// Installed version, store pe live version se purani hai - jab tak user
// update na kare, yeh poori app ki jagah render hoti hai (dekhein
// app/_layout.js), koi Stack/navigation iske peeche mount hi nahi hoti. Koi
// "Skip"/"Not Now" button jaan-boojh kar nahi hai - update mandatory hai.
export function MandatoryUpdateScreen({ storeUrl, theme }) {
  async function handleUpdate() {
    // Dono platforms par pehle unka apna "direct to store app" URL scheme try
    // karte hain (seedha Play Store/App Store app khulti hai) - fail hone par
    // (rare) normal https link pe fallback.
    if (Platform.OS === "android") {
      try {
        await Linking.openURL("market://details?id=com.sheikhgroup.remindsme");
        return;
      } catch {
        // fallback below
      }
    }
    if (Platform.OS === "ios") {
      try {
        await Linking.openURL("itms-apps://apps.apple.com/app/id6802544860");
        return;
      } catch {
        // fallback below
      }
    }
    Linking.openURL(storeUrl);
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient
        colors={[theme.gradientStart, theme.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.iconBadge}
      >
        <Ionicons name="rocket-outline" size={36} color="#fff" />
      </LinearGradient>

      <Text style={[styles.title, { color: theme.text }]}>Update Required</Text>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
        A new version of Reminds Me is available. Please update to continue using the app.
      </Text>

      <TouchableOpacity onPress={handleUpdate} activeOpacity={0.85} style={styles.updateButtonWrap}>
        <LinearGradient
          colors={[theme.gradientStart, theme.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.updateButton}
        >
          <Text style={styles.updateButtonText}>Update Now</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  iconBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 12,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 30,
    maxWidth: 320,
  },
  updateButtonWrap: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 14,
  },
  updateButton: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  updateButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
