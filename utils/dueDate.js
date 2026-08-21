// Due date 7 din ya usse kam door hai (ya guzar chuki hai) to "urgent" (red) -
// warna abhi kaafi waqt hai, is liye normal color.
export function isDueSoon(dueDateISO) {
  const diffDays = (new Date(dueDateISO) - new Date()) / (1000 * 60 * 60 * 24);
  return diffDays <= 7;
}

// Sirf rang ke liye - "overdue" (guzar chuki) aur "soon" (jald aane wali,
// abhi guzri nahi) ko alag dikhate hain (red vs amber), taake genuinely
// overdue payment aur sirf-jald-due payment ek jaisi na lagein.
export function getDueUrgency(dueDateISO) {
  const diffDays = (new Date(dueDateISO) - new Date()) / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return "overdue";
  if (diffDays <= 7) return "soon";
  return "normal";
}

// Due date abhi guzri nahi (overdue nahi) aur agle 24 ghante/1 din ke andar
// hai - sirf ye hi cards ka due date "urgent" pulsing icon dikhata hai (overdue
// apna alag red state rakhta hai, isse conflict nahi karta).
export function isDueWithinOneDay(dueDateISO) {
  const diffDays = (new Date(dueDateISO) - new Date()) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= 1;
}
