// "Ledger" (lend/borrow) payments same person ke naam se link hoti hain -
// yeh helpers un sab ko group karke ek net balance aur pura transaction
// history nikalte hain.

export function getLedgerEntriesForPerson(payments, personName) {
  const q = personName.trim().toLowerCase();
  return payments.filter((p) => p.category === "ledger" && p.title.trim().toLowerCase() === q);
}

// Ledger entry ka kitna hissa abhi tak receive/pay ho chuka hai - "amount"
// hamesha total owed rehta hai, "amountReceived" partial settlements jama karta hai.
export function remainingBalance(payment) {
  return Math.max(payment.amount - (payment.amountReceived ?? 0), 0);
}

// Ek person ki saari ledger entries se uska net balance nikalta hai -
// "toReceive" = wo aapko dene hain, "toPay" = aapko unhe dene hain.
export function computePersonBalance(entries) {
  let toReceive = 0;
  let toPay = 0;

  entries.forEach((e) => {
    const remaining = remainingBalance(e);
    if (remaining <= 0) return;
    if (e.ledgerDirection === "borrowed") {
      toPay += remaining;
    } else {
      toReceive += remaining;
    }
  });

  return { toReceive, toPay, net: toReceive - toPay };
}

// Poori app ki saari ledger payments se overall total nikalta hai - Dashboard
// ke "Lending" section ke liye.
export function computeLedgerTotals(payments) {
  const entries = payments.filter((p) => p.category === "ledger");
  let totalToReceive = 0;
  let totalToPay = 0;

  entries.forEach((e) => {
    const remaining = remainingBalance(e);
    if (remaining <= 0) return;
    if (e.ledgerDirection === "borrowed") {
      totalToPay += remaining;
    } else {
      totalToReceive += remaining;
    }
  });

  return { totalToReceive, totalToPay };
}

// Payment card tap karne par kis screen par jana hai - Ledger entries ke liye
// us person ki poori history wali screen, baaki sab ke liye generic detail screen.
export function getPaymentDetailRoute(payment) {
  if (payment.category === "ledger") {
    return { pathname: "/ledger-person", params: { name: payment.title } };
  }
  return `/payment/${payment.id}`;
}

// Saari Ledger entries ko person (naam) ke hisaab se group karta hai - Ledger
// tab ki contact list isi se banti hai. Naam match case-insensitive/trimmed
// hai (getLedgerEntriesForPerson jaisa hi), taake "John" aur "john " ek hi
// contact maane jayein - koi alag "contacts" collection nahi, identity hamesha
// naam hi hai (existing data model ka hissa).
export function groupLedgerContacts(payments) {
  const entries = payments.filter((p) => p.category === "ledger");
  const byName = new Map();

  entries.forEach((e) => {
    const key = e.title.trim().toLowerCase();
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(e);
  });

  return Array.from(byName.values()).map((group) => {
    const sorted = [...group].sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate));
    return {
      name: group[0].title.trim(),
      phoneNumber: group.find((e) => e.phoneNumber)?.phoneNumber ?? "",
      balance: computePersonBalance(group),
      lastTransactionDate: sorted[0].dueDate,
      entryCount: group.length,
    };
  });
}

// Ek person ki history ko timeline (purani se nayi) mein chalte hue har
// transaction ke baad ka cumulative balance nikalta hai - taake har row apna
// "us waqt ka balance" dikha sake. Koi naya data invent nahi karta, sirf
// existing amount/amountReceived/ledgerDirection/dueDate se derive hota hai.
// Positive = person aapko wo dene hain, negative = aap unhe dene hain. Aakhri
// (sabse nayi) entry ka runningBalance hamesha computePersonBalance() ke
// "net" se match karta hai.
export function computeHistoryWithRunningBalance(entries) {
  const chronological = [...entries].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  let running = 0;
  const withBalance = chronological.map((e) => {
    const remaining = remainingBalance(e);
    running += e.ledgerDirection === "borrowed" ? -remaining : remaining;
    return { ...e, runningBalance: running };
  });
  return withBalance.reverse();
}
