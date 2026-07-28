import { addOneMonth, updatePayment } from "./storage";
import { cancelPaymentReminder, schedulePaymentReminder } from "./notifications";
import { remainingBalance } from "./ledger";

// Payment ko paid mark karta hai. Recurring payments ke liye naya record nahi
// banta - isi record ki due date agle mahine ke liye advance ho jati hai aur
// abhi wali due date paidHistory mein jama ho jati hai (monthly graph ke liye).
// Isi wajah se home screen par ek hi card "recycle" hota rehta hai.
export async function markPaymentPaid(payment) {
  await cancelPaymentReminder(payment.notificationId);

  if (payment.isRecurring) {
    const fulfilledDueDate = payment.dueDate;
    const paidAt = new Date().toISOString();
    const nextDueDate = addOneMonth(payment.dueDate);
    const notificationId = await schedulePaymentReminder({ ...payment, dueDate: nextDueDate });

    await updatePayment(payment.id, {
      isPaid: true,
      paidDate: paidAt,
      dueDate: nextDueDate,
      // Har entry apni dueDate AUR paidDate dono rakhti hai - taake baad mein
      // "on-time thi ya late" nikala ja sake (streak ke liye zaroori hai).
      paidHistory: [...(payment.paidHistory ?? []), { dueDate: fulfilledDueDate, paidDate: paidAt }],
      notificationId,
    });
  } else {
    await updatePayment(payment.id, {
      isPaid: true,
      paidDate: new Date().toISOString(),
    });
  }
}

// Ledger entry par ek partial (ya poora) payment record karta hai - "amount"
// hamesha total owed rehta hai, "amountReceived" mein jama hota jata hai.
// Jab poora settle ho jaye (remaining 0 ya kam) to entry ko paid mark kar dete
// hain aur uska reminder cancel kar dete hain (recurring nahi hota, isliye
// markPaymentPaid jaisa recycle nahi karna).
export async function recordLedgerPayment(payment, amountApplied) {
  const newReceived = (payment.amountReceived ?? 0) + amountApplied;
  const remaining = remainingBalance({ ...payment, amountReceived: newReceived });

  if (remaining <= 0) {
    await cancelPaymentReminder(payment.notificationId);
    await updatePayment(payment.id, {
      amountReceived: payment.amount,
      isPaid: true,
      paidDate: new Date().toISOString(),
    });
  } else {
    await updatePayment(payment.id, { amountReceived: newReceived });
  }
}

// Recurring payment ka current cycle "skip" karta hai - jaise markPaymentPaid,
// due date agle mahine ke liye advance hoti hai, lekin isPaid/paidHistory
// nahi badalti (kyunki asal mein payment nahi hui). Skipped due date apni
// alag "skippedHistory" mein jama hoti hai, taake Monthly History mein "paid"
// se alag dikhaya ja sake.
export async function skipPaymentThisMonth(payment) {
  if (!payment.isRecurring) return;

  await cancelPaymentReminder(payment.notificationId);

  const skippedDueDate = payment.dueDate;
  const nextDueDate = addOneMonth(payment.dueDate);
  const notificationId = await schedulePaymentReminder({ ...payment, dueDate: nextDueDate });

  await updatePayment(payment.id, {
    dueDate: nextDueDate,
    skippedHistory: [...(payment.skippedHistory ?? []), skippedDueDate],
    notificationId,
  });
}
