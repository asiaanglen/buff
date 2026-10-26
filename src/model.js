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
