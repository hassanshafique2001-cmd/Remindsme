// Ek hi jagah se category list manage hoti hai - Add/Edit screen ke chips
// aur Home screen ke cards, dono isi se apna data lete hain. Har category ka
// apna "color" hai - icon badges, chips aur dashboard bars sab isi se
// (theme.primary ki jagah) apna rang lete hain, taake categories ek nazar
// mein alag pehchani ja sakein.
export const CATEGORIES = [
  { key: "rent", label: "Rent", icon: "home", color: "#3B82F6" },
  { key: "car", label: "Car", icon: "car", color: "#F97316" },
  { key: "insurance", label: "Insurance", icon: "shield-checkmark", color: "#14B8A6" },
  { key: "subscription", label: "Subscription", icon: "repeat", color: "#8B5CF6" },
  { key: "bills", label: "Bills", icon: "flash", color: "#EAB308" },
  { key: "ledger", label: "Ledger", icon: "person-circle-outline", color: "#F43F5E" },
  { key: "other", label: "Other", icon: "ellipsis-horizontal", color: "#EC4899" },
];

export function getCategory(key) {
  return CATEGORIES.find((c) => c.key === key) ?? CATEGORIES[CATEGORIES.length - 1];
}
