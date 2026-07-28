import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  where,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import { addOneMonth } from "./storage";

const SHARED_COLLECTION = "sharedPayments";

// Kisi doosre "Reminds Me" user ko uski email se dhoondhta hai - taake use
// shared bill mein participant ke tor par add kiya ja sake. `users/{uid}`
// docs ab kisi bhi signed-in user ke liye readable hain (firestore.rules
// dekhein), isi liye yeh query kaam karti hai.
export async function findUserByEmail(email) {
  const normalized = email.trim().toLowerCase();
  const q = query(collection(db, "users"), where("email", "==", normalized));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const found = snap.docs[0];
  return { uid: found.id, ...found.data() };
}

// participants: [{ uid, email, displayName, share }, ...] - current user
// (banane wala) bhi isi list mein shamil hona chahiye.
export async function createSharedPayment({ title, category, amount, dueDate, isRecurring, participants }) {
  const participantsMap = {};
  const memberUids = [];
  participants.forEach((p) => {
    participantsMap[p.uid] = {
      email: p.email,
      displayName: p.displayName,
      share: p.share,
      hasPaid: false,
      paidDate: null,
    };
    memberUids.push(p.uid);
  });

  const docRef = await addDoc(collection(db, SHARED_COLLECTION), {
    title,
    category,
    amount,
    dueDate,
    isRecurring: isRecurring ?? true,
    notes: "",
    createdBy: auth.currentUser.uid,
    createdAt: new Date().toISOString(),
    memberUids,
    participants: participantsMap,
    paidHistory: [],
  });
  return docRef.id;
}

// Live list - jab bhi koi participant apna share pay kare, dono/saare
// members ki screen turant update ho jati hai (real-time sync).
export function subscribeToMySharedPayments(uid, callback) {
  const q = query(collection(db, SHARED_COLLECTION), where("memberUids", "array-contains", uid));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

// Transaction mein karte hain taake do participants agar theek usi waqt apna
// share pay karein to unka update ek dusre ko overwrite na kare. Jab SAARE
// participants pay kar dein aur bill recurring ho, to poora cycle reset ho
// kar agle mahine ke liye advance ho jata hai (personal recurring payments
// jesa hi "recycle" pattern).
export async function markMySharePaid(sharedId, uid) {
  const ref = doc(db, SHARED_COLLECTION, sharedId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const data = snap.data();
    const now = new Date().toISOString();

    const participants = { ...data.participants };
    participants[uid] = { ...participants[uid], hasPaid: true, paidDate: now };

    const allPaid = Object.values(participants).every((p) => p.hasPaid);

    if (allPaid && data.isRecurring) {
      const fulfilledDueDate = data.dueDate;
      const nextDueDate = addOneMonth(data.dueDate);
      const resetParticipants = {};
      Object.entries(participants).forEach(([pUid, p]) => {
        resetParticipants[pUid] = { ...p, hasPaid: false, paidDate: null };
      });
      tx.update(ref, {
        participants: resetParticipants,
        dueDate: nextDueDate,
        paidHistory: [...(data.paidHistory ?? []), { dueDate: fulfilledDueDate, paidDate: now }],
      });
    } else {
      tx.update(ref, { participants });
    }
  });
}

export async function deleteSharedPayment(sharedId) {
  await deleteDoc(doc(db, SHARED_COLLECTION, sharedId));
}
