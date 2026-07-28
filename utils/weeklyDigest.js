import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { getPayments } from "./storage";

const DIGEST_ID_KEY = "weeklyDigestNotificationId";

// Agle Monday subah 9 baje ka Date object deta hai - agar aaj hi Monday hai
// aur 9 AM abhi nahi guzra to aaj hi wapis karta hai, warna agle hafte ka.
function nextMonday9am() {
  const now = new Date();
  const result = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0, 0);
  const daysUntilMonday = (8 - result.getDay()) % 7;
  result.setDate(result.getDate() + daysUntilMonday);
  if (result.getTime() <= now.getTime()) {
    result.setDate(result.getDate() + 7);
  }
  return result;
}

// "Is hafte" ka matlab hai us Monday se agle Monday tak (jab digest fire hoga) -
// isliye "now" se nahi, balkay target Monday ki date se hi window nikalte hain.
function computeWeekWindow(payments, mondayDate) {
  const weekStart = new Date(mondayDate.getFullYear(), mondayDate.getMonth(), mondayDate.getDate());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  const due = payments.filter((p) => {
    // Recurring payments ka "isPaid" hamesha true reh jata hai pichli baar
    // paid hone ke baad bhi (dueDate agle cycle mein aage badh jati hai) -
    // isliye poore codebase ki tarah "abhi bhi outstanding hai" check yehi hai.
    const isOutstanding = p.isRecurring || !p.isPaid;
    if (!isOutstanding) return false;
    const d = new Date(p.dueDate);
    return d >= weekStart && d < weekEnd;
  });
  const total = due.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  return { count: due.length, total };
}

// Local notification ka content schedule hote hi fix ho jata hai (fire hote
// waqt dobara compute nahi hota), isliye hum har app open/foreground par
// purana digest cancel karke naya schedule kar dete hain - taake content
// hamesha jitna ho sake fresh rahe. Call sites: app/_layout.js.
export async function scheduleWeeklyDigest() {
  if (Platform.OS === "web") return;

  const previousId = await AsyncStorage.getItem(DIGEST_ID_KEY);
  if (previousId) {
    await Notifications.cancelScheduledNotificationAsync(previousId).catch(() => {});
    await AsyncStorage.removeItem(DIGEST_ID_KEY);
  }

  const triggerDate = nextMonday9am();
  const payments = await getPayments();
  const { count, total } = computeWeekWindow(payments, triggerDate);
  if (count === 0) return;

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: "This Week's Payments",
      body: `You have ${count} payment${count > 1 ? "s" : ""} due this week, totaling $${total.toFixed(2)}.`,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
    },
  });

  await AsyncStorage.setItem(DIGEST_ID_KEY, notificationId);
}
