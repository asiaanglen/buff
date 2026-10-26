export const uid = () => crypto.randomUUID();
export function weekStart(date = new Date()) {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return key(d);
}
export function key(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function addDays(date, n) {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() + n);
  return key(d);
}
export function exercise(
  name,
  sets = 3,
  target = 10,
  mode = "reps",
  weight = 0,
  group = "",
) {
  return {
    id: uid(),
    name,
    sets,
    target,
    mode,
    weight,
    group,
    logs: Array.from({ length: sets }, () => ({
      weight: "",
      actual: "",
      done: false,
    })),
  };
}
export function initialState() {
  const w = key(new Date());
  return {
    version: 1,
    unit: "kg",
    programs: [],
    workouts: [
      {
        id: uid(),
        date: w,
        name: "Upper body strength",
        note: "Build a strong foundation. Keep every rep controlled.",
        exercises: [
          exercise("Barbell bench press", 4, 8, "reps", 40),
          exercise("Single-arm dumbbell row", 3, 12, "reps", 16, "A"),
          exercise("Dumbbell shoulder press", 3, 10, "reps", 12, "A"),
          exercise("Plank", 3, 45, "time"),
        ],
      },
    ],
  };
}
export function progress(workout) {
  const logs = workout.exercises.flatMap((e) => e.logs);
  return { total: logs.length, done: logs.filter((l) => l.done).length };
}

export {
  MAX_PROGRAM_WEEKS,
  programWeek,
  programEnd,
  programError,
  shiftDate,
  daysApart,
} from "../shared/programs.js";
import { programWeek, shiftDate } from "../shared/programs.js";
export function copyProgramWeek(state, programId, from, to) {
  const p = (state.programs || []).find((p) => p.id === programId);
  if (
    !p ||
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    from === to ||
    from < 1 ||
    to < 1 ||
    from > p.weeks ||
    to > p.weeks
  )
    throw Error("Choose a different week within this program.");
  const originals = state.workouts.filter(
    (w) => w.programId === p.id && programWeek(p, w.date) === from,
  );
  if (state.workouts.length + originals.length > 5000)
    throw Error("This copy would exceed the journal’s 5,000-workout limit.");
  const copies = originals.map((w) => ({
    ...structuredClone(w),
    id: uid(),
    date: shiftDate(w.date, (to - from) * 7),
    exercises: w.exercises.map((e) => ({
      ...structuredClone(e),
      id: uid(),
      logs: e.logs.map(() => ({ weight: "", actual: "", done: false })),
    })),
  }));
  state.workouts.push(...copies);
  return copies;
}
export function importGuest(current, guest) {
  const merged = structuredClone(current);
  merged.programs ||= [];
  const map = new Map();
  let programs = 0;
  for (const p of guest?.programs || []) {
    const existing = merged.programs.find((x) => x.id === p.id);
    if (existing && JSON.stringify(existing) === JSON.stringify(p)) {
      map.set(p.id, p.id);
      continue;
    }
    const copy = { ...structuredClone(p), id: existing ? uid() : p.id };
    merged.programs.push(copy);
    map.set(p.id, copy.id);
    programs++;
  }
  const ids = new Set(merged.workouts.map((w) => w.id));
  const extras = (guest?.workouts || [])
    .filter((w) => !ids.has(w.id))
    .map((w) => {
      const copy = structuredClone(w);
      if (copy.programId) {
        const id = map.get(copy.programId);
        if (id) copy.programId = id;
        else delete copy.programId;
      }
      return copy;
    });
  merged.workouts.push(...extras);
  return { state: merged, workouts: extras.length, programs };
}
