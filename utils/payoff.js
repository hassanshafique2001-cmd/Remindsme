import { addOneMonth } from "./storage";

// Payment ka "loanTermMonths" (optional) - total kitni monthly payments mein
// yeh loan/plan poora ho jayega. paidHistory ki length se pata chalta hai
// abhi tak kitni ho chuki hain, baaki se remaining aur payoff date nikalte hain.
export function computePayoff(payment) {
  const term = payment.loanTermMonths;
  if (!term || term <= 0) return null;

  const paidCount = (payment.paidHistory ?? []).length;
  const remaining = Math.max(term - paidCount, 0);
  const percent = Math.round((Math.min(paidCount, term) / term) * 100);

  if (remaining === 0) {
    return { remaining: 0, payoffDate: null, isPaidOff: true, percent: 100 };
  }

  // Current dueDate abhi ki agli (na-adaa-shuda) payment hai - is liye baqi
  // (remaining - 1) mahine aage badhkar aakhri payment ki date milti hai.
  let payoffDateISO = payment.dueDate;
  for (let i = 0; i < remaining - 1; i++) {
    payoffDateISO = addOneMonth(payoffDateISO);
  }

  return { remaining, payoffDate: payoffDateISO, isPaidOff: false, percent };
}
