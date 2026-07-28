import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { getCategory } from "./categories";

const CSV_HEADER = ["Title", "Category", "Amount", "Due Date", "Recurring", "Status", "Paid Date"];

function csvEscape(value) {
  const str = String(value ?? "");
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function toCsv(payments) {
  const rows = payments.map((p) => [
    p.title,
    getCategory(p.category).label,
    p.amount,
    new Date(p.dueDate).toLocaleDateString("en-US"),
    p.isRecurring ? "Yes" : "No",
    p.isPaid ? "Paid" : "Unpaid",
    p.paidDate ? new Date(p.paidDate).toLocaleDateString("en-US") : "",
  ]);
  return [CSV_HEADER, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
}

// Saari payments ko CSV file bana kar native share sheet mein khol deta hai -
// wahan se user Files mein save kar sakta hai, email kar sakta hai, wagera.
// Web par sirf FileSystem/Sharing native modules kaam nahi karte, isliye guard.
export async function exportPaymentsToCsv(payments) {
  if (Platform.OS === "web") {
    throw new Error("CSV export is only available on the mobile app.");
  }
  if (payments.length === 0) {
    throw new Error("No payments to export yet.");
  }

  const csv = toCsv(payments);
  const fileUri = `${FileSystem.cacheDirectory}reminds-me-payments.csv`;
  await FileSystem.writeAsStringAsync(fileUri, csv);

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error("Sharing isn't available on this device.");
  }

  await Sharing.shareAsync(fileUri, {
    mimeType: "text/csv",
    dialogTitle: "Export Payments",
    UTI: "public.comma-separated-values-text",
  });
}
