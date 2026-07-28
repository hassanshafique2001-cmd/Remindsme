import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { getCategory } from "../utils/categories";
import { useTheme, withAlpha } from "../utils/theme";

// "+" FAB dabate hi yeh screen khulti hai - user pehle decide karta hai ke
// ussay ek normal bill/expense add karni hai ya kisi doosre insaan ke saath
// paison ka len-den (Ledger) track karna hai. Dono options aakhir mein isi
// "/add-payment" form par le jate hain, bas Ledger wala category=ledger
// param ke saath jata hai taake wahan sahi fields pehle se dikhein.
export default function ChoosePaymentTypeScreen() {
  const router = useRouter();
  const theme = useTheme();
  const styles = getStyles(theme);
  const ledger = getCategory("ledger");

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "New Reminder" }} />
      <Text style={styles.subtitle}>What would you like to add?</Text>

      <TouchableOpacity
        style={[
          styles.optionCard,
          { backgroundColor: withAlpha(theme.primary, theme.mode === "dark" ? 0.18 : 0.08) },
        ]}
        onPress={() => router.push("/add-payment")}
      >
        <View
          style={[
            styles.iconBadge,
            { backgroundColor: withAlpha(theme.primary, theme.mode === "dark" ? 0.28 : 0.15) },
          ]}
        >
          <Ionicons name="receipt-outline" size={26} color={theme.primary} />
        </View>
        <View style={styles.optionTextGroup}>
          <Text style={styles.optionTitle}>Bill or Expense</Text>
          <Text style={styles.optionSubtitle}>Rent, car, insurance, subscriptions, utilities...</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.optionCard,
          { backgroundColor: withAlpha(ledger.color, theme.mode === "dark" ? 0.18 : 0.08) },
        ]}
        onPress={() => router.push({ pathname: "/add-payment", params: { category: "ledger" } })}
      >
        <View
          style={[
            styles.iconBadge,
            { backgroundColor: withAlpha(ledger.color, theme.mode === "dark" ? 0.28 : 0.15) },
          ]}
        >
          <Ionicons name={ledger.icon} size={26} color={ledger.color} />
        </View>
        <View style={styles.optionTextGroup}>
          <Text style={styles.optionTitle}>Lend or Borrow Money</Text>
          <Text style={styles.optionSubtitle}>Track money you give to or take from someone</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

function getStyles(theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
      padding: 20,
    },
    subtitle: {
      fontSize: 14,
      color: theme.textSecondary,
      marginBottom: 20,
    },
    optionCard: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
    },
    iconBadge: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 14,
    },
    optionTextGroup: {
      flex: 1,
    },
    optionTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.text,
    },
    optionSubtitle: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 3,
    },
  });
}
