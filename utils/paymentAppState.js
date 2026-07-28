// "Open App" dabane ke baad user jab dubara Reminds Me pe wapis aaye, to hum
// poochte hain "kya payment ho gayi?". Yahan track karte hain KAUNSi payment
// ke liye Open App dabaya gaya tha aur KAB - module-scope variable hi kaafi
// hai (app restart hone par khud reset ho jata hai, isi session ke liye chahiye).
let lastOpened = null;

const RELEVANT_WINDOW_MS = 30 * 60 * 1000; // 30 minute se purana ho to na poochein

export function recordAppOpened(paymentId) {
  lastOpened = { paymentId, openedAt: Date.now() };
}

// Ek dafa consume hone ke baad reset kar dete hain - taake har baar app
// foreground mein aane par dobara na poochay, sirf ek dafa.
export function consumeRecentlyOpenedPayment() {
  if (!lastOpened) return null;
  const isRecent = Date.now() - lastOpened.openedAt <= RELEVANT_WINDOW_MS;
  const paymentId = lastOpened.paymentId;
  lastOpened = null;
  return isRecent ? paymentId : null;
}
