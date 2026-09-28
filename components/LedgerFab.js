import { useRef } from "react";
import { Animated, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getCategory } from "../utils/categories";

// Ledger tab aur contact-detail screen dono ka "+" - Payments ke FAB se
// jaan-boojh kar alag hai (gradient nahi, ledger ka apna solid brand color)
// taake dono screens ka "+" visually kabhi mix na ho. Press par halka
// scale-down bhi hota hai (subtle micro-interaction).
export function LedgerFab({ onPress }) {
  const scale = useRef(new Animated.Value(1)).current;
  const ledgerColor = getCategory("ledger").color;

  function pressIn() {
    Animated.spring(scale, { toValue: 0.9, useNativeDriver: true, speed: 40 }).start();
  }
  function pressOut() {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start();
  }

  return (
    <TouchableOpacity
      style={[styles.fab, { shadowColor: ledgerColor }]}
      activeOpacity={0.9}
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
    >
      <Animated.View style={[styles.fabInner, { backgroundColor: ledgerColor, transform: [{ scale }] }]}>
        <Ionicons name="add" size={26} color="#fff" />
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 20,
    bottom: 30,
    width: 58,
    height: 58,
    borderRadius: 29,
    elevation: 6,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  fabInner: {
    width: "100%",
    height: "100%",
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
  },
});
