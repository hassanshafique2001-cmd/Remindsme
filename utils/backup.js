import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import { getPayments, restorePayment, updatePayment } from "./localPayments";
import { schedulePaymentReminder } from "./notifications";

const BACKUP_VERSION = 1;

// Guest (local-only) payments ko ek JSON file mein likh kar native share
// sheet mein khol deta hai - wahan se user Files app, email, wagera mein
// save kar sakta hai future restore ke liye.
export async function exportBackup() {
  if (Platform.OS === "web") {
    throw new Error("Backup export is only available on the mobile app.");
  }

  const payments = await getPayments();
  if (payments.length === 0) {
    throw new Error("No payments to back up yet.");
  }

  const backup = { version: BACKUP_VERSION, exportedAt: new Date().toISOString(), payments };
  const fileUri = `${FileSystem.cacheDirectory}reminds-me-backup.json`;
  await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(backup, null, 2));

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error("Sharing isn't available on this device.");
  }

  await Sharing.shareAsync(fileUri, {
    mimeType: "application/json",
    dialogTitle: "Backup Payments",
    UTI: "public.json",
  });
}

// Backup JSON file se payments restore karta hai - naye unique ids assign
// hoti hain (purani ids se clash na ho) aur har payment ke liye reminder
// dubara schedule hota hai (purana native notification ab valid nahi raha).
// Return value: kitni payments restore hui.
export async function importBackup() {
  if (Platform.OS === "web") {
    throw new Error("Backup import is only available on the mobile app.");
  }

  const result = await DocumentPicker.getDocumentAsync({
    type: "application/json",
    copyToCacheDirectory: true,
  });
  if (result.canceled) return 0;

  const raw = await FileSystem.readAsStringAsync(result.assets[0].uri);
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("This file doesn't look like a Reminds Me backup.");
  }

  const payments = Array.isArray(parsed) ? parsed : parsed.payments;
  if (!Array.isArray(payments)) {
    throw new Error("This file doesn't look like a Reminds Me backup.");
  }

  let count = 0;
  for (const payment of payments) {
    if (!payment.title || !payment.dueDate) continue;
    const restored = await restorePayment(payment);
    const notificationId = await schedulePaymentReminder(restored);
    if (notificationId) {
      await updatePayment(restored.id, { notificationId });
    }
    count++;
  }
  return count;
}
