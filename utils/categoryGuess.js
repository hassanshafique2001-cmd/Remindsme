import { PROVIDERS } from "./providers";

// Provider names ke alawa kuch generic keywords bhi - taake user provider
// list se select kiye bagair bhi seedha type kare (jaise "car loan") to
// bhi guess kaam kare.
const EXTRA_KEYWORDS = {
  rent: ["rent", "landlord", "apartment", "lease"],
  car: ["car", "auto loan", "vehicle", "auto finance"],
  insurance: ["insurance"],
  subscription: ["subscription", "streaming"],
  bills: [
    "bill",
    "utility",
    "utilities",
    "electric",
    "electricity",
    "gas",
    "power",
    "energy",
    "phone",
    "cell",
    "cellphone",
    "wireless",
    "mobile",
    "carrier",
  ],
  other: [],
};

function buildKeywordMap() {
  const map = {};
  Object.entries(PROVIDERS).forEach(([category, providers]) => {
    map[category] = providers.map((p) => p.toLowerCase());
  });
  Object.entries(EXTRA_KEYWORDS).forEach(([category, words]) => {
    map[category] = [...(map[category] ?? []), ...words];
  });
  return map;
}

const KEYWORD_MAP = buildKeywordMap();

// Title mein koi jaana-pehchana provider/keyword mile to uski category
// return karta hai, warna null. Kam se kam 3 characters chahiye - warna
// bohot chhote/adhoore typed text par galat guess ho sakta hai.
export function guessCategory(title) {
  const q = title.trim().toLowerCase();
  if (q.length < 3) return null;

  for (const category of Object.keys(KEYWORD_MAP)) {
    const keywords = KEYWORD_MAP[category];
    if (keywords.some((kw) => kw && q.includes(kw))) {
      return category;
    }
  }
  return null;
}
