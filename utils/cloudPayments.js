import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";

// Har user ki payments uske apne "users/{uid}/payments" subcollection mein
// rehti hain - is liye alag accounts ka data kabhi mix nahi hota.
function paymentsRef(uid) {
  return collection(db, "users", uid, "payments");
}

export async function getPayments(uid) {
  const snapshot = await getDocs(paymentsRef(uid));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addPayment(uid, payment) {
  const id = Date.now().toString() + Math.random().toString(36).slice(2, 8);
  const newPayment = {
    title: payment.title,
    category: payment.category,
    amount: payment.amount,
    dueDate: payment.dueDate,
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
  await setDoc(doc(paymentsRef(uid), id), newPayment);
  return { id, ...newPayment };
}

export async function updatePayment(uid, id, updates) {
  await updateDoc(doc(paymentsRef(uid), id), updates);
}

export async function deletePayment(uid, id) {
  await deleteDoc(doc(paymentsRef(uid), id));
}
