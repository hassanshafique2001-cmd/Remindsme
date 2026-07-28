// paidHistory ki purani entries sirf date-string thi (jaise "2026-03-01T..."),
// nayi entries { dueDate, paidDate } object hain - dono format yahan handle
// karte hain taake purana data crash na kare.
export function normalizeHistoryEntry(entry) {
  if (typeof entry === "string") {
    return { dueDate: entry, paidDate: null };
  }
  return entry;
}

// Ek entry "on-time" hai agar uski paidDate ka calendar-din dueDate ke din ya
// usse pehle ho (ghante-minute ignore karte hain, sirf din matter karta hai).
// Purani entries jinki paidDate maloom nahi unhe on-time maan lete hain
// (benefit of the doubt), taake purane users ka streak achanak na toot jaye.
function isOnTime(entry) {
  if (!entry.paidDate) return true;
  const due = new Date(entry.dueDate);
  const paid = new Date(entry.paidDate);
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
  const paidDay = new Date(paid.getFullYear(), paid.getMonth(), paid.getDate()).getTime();
  return paidDay <= dueDay;
}

// Sabse recent paidHistory entry se peeche ki taraf ginta hai, pehli "late"
// entry par ruk jata hai - yani "abhi kitne consecutive on-time payments hue hain".
export function computeStreak(payment) {
  const history = payment.paidHistory ?? [];
  let streak = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const entry = normalizeHistoryEntry(history[i]);
    if (isOnTime(entry)) {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
}

// Saari payments ki paidHistory (aur non-recurring ki apni paidDate) mila kar
// ek overall "kitne % payments waqt par hue" score deta hai. Koi paid history
// na ho to null (score dikhane ka koi matlab nahi).
export function computeDisciplineScore(payments) {
  let total = 0;
  let onTime = 0;

  payments.forEach((p) => {
    (p.paidHistory ?? []).forEach((raw) => {
      const entry = normalizeHistoryEntry(raw);
      total += 1;
      if (isOnTime(entry)) onTime += 1;
    });

    if (!p.isRecurring && p.isPaid && p.paidDate) {
      total += 1;
      if (isOnTime({ dueDate: p.dueDate, paidDate: p.paidDate })) onTime += 1;
    }
  });

  if (total === 0) return null;
  return Math.round((onTime / total) * 100);
}
