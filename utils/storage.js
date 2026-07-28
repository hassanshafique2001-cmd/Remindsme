import { auth } from "./firebase";
import * as local from "./localPayments";
import * as cloud from "./cloudPayments";

// Poori app yahi functions call karti hai (getPayments, addPayment, etc.) -
// login state ke hisaab se yeh khud faisla karta hai ke data is phone (local)
// se aana/jana hai ya us user ke Firestore account (cloud) se. Isi liye kisi
// bhi screen ko badalne ki zaroorat nahi padi jab cloud sync add kiya gaya.
function currentUid() {
  return auth.currentUser?.uid ?? null;
}

export async function getPayments() {
  const uid = currentUid();
  return uid ? cloud.getPayments(uid) : local.getPayments();
}

export async function addPayment(payment) {
  const uid = currentUid();
  return uid ? cloud.addPayment(uid, payment) : local.addPayment(payment);
}

export async function updatePayment(id, updates) {
  const uid = currentUid();
  return uid ? cloud.updatePayment(uid, id, updates) : local.updatePayment(id, updates);
}

export async function deletePayment(id) {
  const uid = currentUid();
  return uid ? cloud.deletePayment(uid, id) : local.deletePayment(id);
}

// Due date ko ek mahina aage barhata hai, month-end edge cases (jaise Jan 31)
// ko sahi tarah handle karte hue (Feb mein 31 tareekh nahi hoti to 28/29 par clamp hoti hai).
export function addOneMonth(dateISO) {
  const date = new Date(dateISO);
  const day = date.getDate();
  const next = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  const daysInNextMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, daysInNextMonth));
  next.setHours(date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds());
  return next.toISOString();
}
