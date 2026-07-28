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
