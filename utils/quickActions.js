import { adsSupported } from "./ads";

// "expo-quick-actions" bhi google-mobile-ads jesa hi native-only module hai -
// isliye wahi "adsSupported" flag reuse karte hain (asal matlab: custom dev
// build/production, Expo Go ya web nahi). Sirf yahan aur sirf tab require
// karte hain jab yeh true ho, warna Expo Go mein module load hote hi crash
// ho jati (native binding turant dhoondti hai).
let QuickActions = null;
if (adsSupported) {
  QuickActions = require("expo-quick-actions");
}

// App icon long-press karne par "Add Payment" shortcut dikhata hai - seedha
// Add Payment screen par le jata hai bina app kholay list mein se dhoondne ke.
export async function setupQuickActions() {
  if (!QuickActions) return;
  await QuickActions.setItems([
    {
      id: "add-payment",
      title: "Add Payment",
      subtitle: "Create a new reminder",
      icon: "add",
      params: { href: "/add-payment" },
    },
  ]);
}

// Agar app hi quick action se (cold start) khuli ho to yeh wahi action deta hai.
export function getInitialQuickAction() {
  return QuickActions?.initial ?? null;
}

// App already open ho aur user quick action dabaye (warm start) to yeh fire hota hai.
export function addQuickActionListener(callback) {
  if (!QuickActions) return { remove() {} };
  return QuickActions.addListener(callback);
}
