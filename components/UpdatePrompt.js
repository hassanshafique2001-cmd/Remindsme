import { Linking, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

// App khulte hi agar naya version available ho to ye modal dikhta hai -
// "Update Now" store listing khol deta hai, "Not Now" sirf is session ke
// liye dismiss karta hai (agli baar app kholne par dobara check hoga).
export function UpdatePrompt({ visible, storeUrl, onDismiss, theme }) {
  async function handleUpdate() {
    // Dono platforms par pehle unka apna "direct to store app" URL scheme try
    // karte hain (Safari/browser ke through jaane ki bajaye seedha Play
    // Store/App Store app khulti hai) - agar kisi wajah se fail ho (bohot
    // rare), normal https link pe fallback.
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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <LinearGradient
            colors={[theme.gradientStart, theme.gradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconBadge}
          >
            <Ionicons name="rocket-outline" size={30} color="#fff" />
          </LinearGradient>

          <Text style={[styles.title, { color: theme.text }]}>Update Available</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            A new version of Reminds Me is ready with improvements and fixes. Update now to get the best experience.
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

          <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[styles.notNowText, { color: theme.textMuted }]}>Not Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 22,
    padding: 26,
    alignItems: "center",
  },
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  title: {
    fontSize: 19,
    fontWeight: "700",
    marginBottom: 10,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginBottom: 22,
  },
  updateButtonWrap: {
    width: "100%",
    borderRadius: 14,
    marginBottom: 14,
  },
  updateButton: {
    width: "100%",
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: "center",
  },
  updateButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  notNowText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
