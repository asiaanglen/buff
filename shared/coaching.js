import { validState } from "./journal.js";
export const personName = (user, fallback = "Your coach") =>
  [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
  fallback;
export function programProgress(workouts) {
  let sets = 0,
    done = 0,
    completed = 0;
  for (const w of workouts) {
    const logs = w.exercises.flatMap((e) => e.logs);
    sets += logs.length;
    done += logs.filter((l) => l.done).length;
    if (logs.length && logs.every((l) => l.done)) completed++;
  }
  return { workouts: workouts.length, completed, sets, setsDone: done };
}
export function applyCoachLog(current, programId, workoutId, input) {
  if (
    !input ||
    !Array.isArray(input.exercises) ||
    input.exercises.length > 200 ||
    (input.complete !== undefined && typeof input.complete !== "boolean")
  )
    throw Error("Enter valid workout results.");
  const state = structuredClone(current);
  if (!state.programs?.some((p) => p.id === programId))
    throw Error("This client removed the assigned program.");
  const workout = state.workouts.find(
    (w) => w.id === workoutId && w.programId === programId,
  );
  if (!workout) throw Error("Workout not found in this assigned program.");
  const seen = new Set();
  for (const change of input.exercises) {
    const e = workout.exercises.find((e) => e.id === change?.id);
    if (
      !e ||
      seen.has(change.id) ||
      !Array.isArray(change.logs) ||
      change.logs.length !== e.sets ||
      (change.note !== undefined &&
        (typeof change.note !== "string" || change.note.length > 1000))
    )
      throw Error("Results must match the assigned exercises and sets.");
    seen.add(change.id);
    e.logs = change.logs.map((l) => ({
      weight: l?.done && l.weight === "" ? e.weight : l?.weight,
      actual: l?.done && l.actual === "" ? e.target : l?.actual,
      done: l?.done,
    }));
    if (change.note !== undefined) e.note = change.note;
  }
  if (input.complete)
    for (const e of workout.exercises)
      for (const l of e.logs) {
        if (l.weight === "") l.weight = e.weight;
        if (l.actual === "") l.actual = e.target;
        l.done = true;
      }
  if (
    !validState(state) ||
    new TextEncoder().encode(JSON.stringify(state)).length > 1024 * 1024
  )
    throw Error(
      "Enter valid weight, reps/time, and completion values. The client’s journal must fit within 1 MB.",
    );
  return state;
}
