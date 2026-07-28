import AsyncStorage from "@react-native-async-storage/async-storage";

const PAYMENTS_KEY = "payments";

// AsyncStorage sirf strings store karta hai, isliye hum payments ki
// array ko JSON string bana kar ek hi key ke andar save karte hain.
// Yeh sirf "guest mode" (jab user login nahi hai) ke liye use hota hai -
// dekhein utils/storage.js jo local vs cloud storage ke beech route karta hai.

export async function getPayments() {
  const raw = await AsyncStorage.getItem(PAYMENTS_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function savePayments(payments) {
  await AsyncStorage.setItem(PAYMENTS_KEY, JSON.stringify(payments));
}

export async function addPayment(payment) {
  const payments = await getPayments();
  const newPayment = {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 8),
    title: payment.title,
    category: payment.category,
    amount: payment.amount,
    dueDate: payment.dueDate, // ISO date string
    isRecurring: payment.isRecurring ?? true,
    notes: payment.notes ?? "",
    appScheme: payment.appScheme ?? "",
    appWebUrl: payment.appWebUrl ?? "",
    reminderDaysBefore: payment.reminderDaysBefore ?? 0,
    loanTermMonths: payment.loanTermMonths ?? null,
    // "Ledger" (lend/borrow) category ke liye - baaki categories ke liye khali/null rehte hain.
    phoneNumber: payment.phoneNumber ?? "",
    ledgerDirection: payment.ledgerDirection ?? null,
    // Ledger entry ka kitna hissa ab tak receive/pay ho chuka hai (partial
    // settlements ke liye) - "amount" hamesha total owed rehta hai.
    amountReceived: payment.amountReceived ?? 0,
    notificationId: null,
    isPaid: false,
    paidDate: null,
    paidHistory: [],
  };
  payments.push(newPayment);
  await savePayments(payments);
  return newPayment;
}

export async function updatePayment(id, updates) {
  const payments = await getPayments();
  const next = payments.map((p) => (p.id === id ? { ...p, ...updates } : p));
  await savePayments(next);
}

export async function deletePayment(id) {
  const payments = await getPayments();
  const next = payments.filter((p) => p.id !== id);
  await savePayments(next);
}

// Backup file restore karne ke liye - "addPayment" ki tarah fields whitelist
// nahi karta (jo isPaid/paidHistory hamesha reset kar deta), balkay poori
// payment object ko waisay ka waisa likh deta hai (paidHistory/skippedHistory
// samet), bas nayi unique id de deta hai taake purani id se clash na ho.
export async function restorePayment(payment) {
  const payments = await getPayments();
  const restored = {
    ...payment,
    id: Date.now().toString() + Math.random().toString(36).slice(2, 8),
    notificationId: null, // purana native notification ab valid nahi hai
  };
  payments.push(restored);
  await savePayments(payments);
  return restored;
}
