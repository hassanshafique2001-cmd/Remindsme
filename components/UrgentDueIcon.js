import { useEffect, useRef } from "react";
import { Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";

// Due date "aaj" ya "1 din baaki" ho to iske saath ek dheeme se blink karte
// caution icon dikhate hain (100% <-> 45% opacity, calm/na-aggressive). Sirf
// eligible cards yeh render karte hain - jab unmount ho (paid/deleted/list se
// hat jaye) to Animated.loop khud stop ho jata hai.
export function UrgentDueIcon({ theme, size = 14 }) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.45, duration: 900, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View style={{ opacity }}>
      <Ionicons name="alert-circle" size={size} color={theme.warning} />
    </Animated.View>
  );
}
