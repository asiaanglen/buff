export const KG_TO_LBS = 2.2046226218487757;
export const pounds = (kg) => Math.round(Number(kg) * KG_TO_LBS * 100) / 100;
// Preserve legacy journals physically, and mark the result to avoid double conversion.
// Storage may remain kg until the next ordinary save; reads consistently expose lbs.
export function inPounds(state) {
  if (!state || state.unit !== "kg") return state;
  const next = structuredClone(state);
  next.unit = "lbs";
  for (const w of next.workouts)
    for (const e of w.exercises) {
      e.weight = pounds(e.weight);
      for (const l of e.logs)
        if (l.weight !== "") l.weight = String(pounds(l.weight));
    }
  return next;
}
