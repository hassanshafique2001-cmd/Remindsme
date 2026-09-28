import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

export const PAYMENT_CATEGORY = "payment-reminder";
export const REMIND_TOMORROW_ACTION = "remind_tomorrow";

// Foreground mein bhi notification banner + sound dikhane ke liye.
// Yeh app load hote hi ek dafa call hoti hai (app/_layout.js se).
export function configureNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

// Notification par ek "Remind Tomorrow" action button register karta hai -
// user notification ko kholay bagair hi snooze kar sakta hai. App load hote
// hi ek dafa call hoti hai (app/_layout.js se).
export async function configureNotificationCategories() {
  if (Platform.OS === "web") return;
  await Notifications.setNotificationCategoryAsync(PAYMENT_CATEGORY, [
    {
      identifier: REMIND_TOMORROW_ACTION,
      buttonTitle: "Remind Tomorrow",
      options: { opensAppToForeground: false },
    },
  ]);
}

// User se notification permission maangte hain. Web par local notifications
// support nahi hoti (sirf physical Android/iOS device par kaam karti hain),
// isliye web par hum silently skip kar dete hain.
export async function requestNotificationPermissions() {
  if (Platform.OS === "web") return false;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === "granted") return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

// Payment ki due date se "reminderDaysBefore" din pehle, subha 9 baje ek local
// reminder schedule karta hai (default 0 = khud due date wale din).
// Return value: notification ki id, jo baad mein cancel karne ke kaam aati hai.
export async function schedulePaymentReminder(payment) {
  if (Platform.OS === "web") return null;

  const granted = await requestNotificationPermissions();
  if (!granted) return null;

  const daysBefore = payment.reminderDaysBefore ?? 0;
  const dueDate = new Date(payment.dueDate);
  const triggerDate = new Date(
    dueDate.getFullYear(),
    dueDate.getMonth(),
    dueDate.getDate() - daysBefore,
    9, // subha 9:00 AM
    0,
    0
  );

  // Agar trigger waqt guzar chuka hai to notification schedule na karein
  // (past date trigger expo-notifications mein error deta hai).
  if (triggerDate.getTime() <= Date.now()) return null;

  const body =
    daysBefore > 0
      ? `${payment.title} - $${payment.amount} is due on ${dueDate.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })} (in ${daysBefore} day${daysBefore > 1 ? "s" : ""}).`
      : `${payment.title} - $${payment.amount} is due today.`;

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: daysBefore > 0 ? "Upcoming Payment" : "Payment Due Today",
      body,
      data: { paymentId: payment.id },
      categoryIdentifier: PAYMENT_CATEGORY,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
    },
  });

  return notificationId;
}

// Ledger transactions ke liye alag reminder scheduler - bills wale "9 AM
// fixed" rule ki jagah, yahan user khud (transaction ki apni date se bilkul
// independent) ek poori date+time "reminderDate" choose karta hai, aur
// chaahe to usi ke upar "Remind Me" (on due date/N din pehle) offset bhi laga
// sakta hai - waqt hamesha reminderDate ka apna waqt rehta hai (9 AM jaisa
// koi fixed rule nahi). Monthly recurring hone par native MONTHLY trigger use
// karte hain - OS khud har mahine usi din/waqt fire karta hai, humein "mark
// paid" jaisi kisi manual reschedule ki zaroorat nahi.
export async function scheduleLedgerReminder(payment) {
  if (Platform.OS === "web") return null;

  const granted = await requestNotificationPermissions();
  if (!granted) return null;

  const daysBefore = payment.reminderDaysBefore ?? 0;
  const base = new Date(payment.reminderDate);
  const reminderDate = new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate() - daysBefore,
    base.getHours(),
    base.getMinutes(),
    0
  );
  const body = payment.notes
    ? `${payment.title} - $${payment.amount} (${payment.notes}).`
    : `${payment.title} - $${payment.amount}.`;

  if (payment.isRecurring) {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: "Ledger Reminder",
        body,
        data: { paymentId: payment.id },
        categoryIdentifier: PAYMENT_CATEGORY,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.MONTHLY,
        day: reminderDate.getDate(),
        hour: reminderDate.getHours(),
        minute: reminderDate.getMinutes(),
      },
    });
  }

  // One-time reminder - agar chuni gayi date+time guzar chuki hai to schedule
  // hi na karein (past date trigger expo-notifications mein error deta hai).
  if (reminderDate.getTime() <= Date.now()) return null;

  return await Notifications.scheduleNotificationAsync({
    content: {
      title: "Ledger Reminder",
      body,
      data: { paymentId: payment.id },
      categoryIdentifier: PAYMENT_CATEGORY,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: reminderDate,
    },
  });
}

export async function cancelPaymentReminder(notificationId) {
  if (Platform.OS === "web" || !notificationId) return;
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

// User ne notification par "Remind Tomorrow" dabaya - agle din usi waqt (9 AM)
// ek naya reminder schedule karta hai. Purana notification pehle hi fire ho
// chuka hota hai (one-time DATE trigger), isliye cancel karne ki zaroorat nahi.
export async function snoozePaymentReminderToTomorrow(payment) {
  if (Platform.OS === "web") return null;

  const triggerDate = new Date();
  triggerDate.setDate(triggerDate.getDate() + 1);
  triggerDate.setHours(9, 0, 0, 0);

  return await Notifications.scheduleNotificationAsync({
    content: {
      title: "Payment Due Today",
      body: `${payment.title} - $${payment.amount} is due today.`,
      data: { paymentId: payment.id },
      categoryIdentifier: PAYMENT_CATEGORY,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
    },
  });
}
