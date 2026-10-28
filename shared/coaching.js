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

// Plan changes never rewrite recorded exercise identities or discard results.
export function applyCoachPlan(
  current,
  programId,
  workoutId,
  input,
  definitions = [],
) {
  const state = structuredClone(current);
  const workout = state.workouts.find(
    (w) => w.id === workoutId && w.programId === programId,
  );
  if (!state.programs?.some((p) => p.id === programId) || !workout)
    throw Error("Workout not found in this assigned program.");
  if (
    !input ||
    !Array.isArray(input.exercises) ||
    !input.exercises.length ||
    input.exercises.length > 200
  )
    throw Error("Include between 1 and 200 exercises.");
  const recorded = (e) =>
    e.logs.some((l) => l.done || l.weight !== "" || l.actual !== "") ||
    Boolean(e.note);
  const seen = new Set();
  const next = input.exercises.map((change) => {
    if (!change || (change.id && seen.has(change.id)))
      throw Error("Exercises must be unique.");
    if (change.id) seen.add(change.id);
    const existing = change.id
      ? workout.exercises.find((e) => e.id === change.id)
      : null;
    if (change.id && !existing)
      throw Error("Exercise not found in this workout.");
    const definition = change.definitionId
      ? definitions.find((d) => d.key === change.definitionId)
      : null;
    if (change.definitionId && !definition)
      throw Error("Choose an exercise from your library.");
    if (!existing && !definition)
      throw Error("Choose an exercise from your library.");
    const swapping =
      definition &&
      (!existing ||
        (definition.custom
          ? existing.customExerciseId !== definition.id
          : existing.libraryId !== definition.id));
    if (existing && swapping && recorded(existing))
      throw Error(
        "This exercise has recorded results. Add a replacement instead to preserve its history.",
      );
    const e = existing
      ? structuredClone(existing)
      : { id: crypto.randomUUID(), logs: [] };
    if (swapping) {
      delete e.libraryId;
      delete e.customExerciseId;
      delete e.videoUrl;
      delete e.instructions;
      delete e.weighted;
      Object.assign(e, { name: definition.name, mode: definition.mode });
      if (definition.custom)
        Object.assign(e, {
          customExerciseId: definition.id,
          instructions: definition.instructions,
          weighted: definition.weighted,
        });
      else e.libraryId = definition.id;
    }
    if (existing && existing.mode !== change.mode && recorded(existing))
      throw Error(
        "Keep the tracking type for exercises with recorded results.",
      );
    if (!Number.isInteger(change.sets) || change.sets < 1 || change.sets > 30)
      throw Error("Choose between 1 and 30 sets.");
    if (
      e.logs
        .slice(change.sets)
        .some((l) => l.done || l.weight !== "" || l.actual !== "")
    )
      throw Error("Cannot remove sets with recorded results.");
    Object.assign(e, {
      sets: change.sets,
      target: change.target,
      weight: e.weighted === false ? 0 : change.weight,
      mode: change.mode,
      group: change.group,
    });
    e.logs = Array.from(
      { length: e.sets },
      (_, i) => e.logs[i] || { weight: "", actual: "", done: false },
    );
    return e;
  });
  if (workout.exercises.some((e) => !seen.has(e.id) && recorded(e)))
    throw Error("Cannot remove exercises with recorded results.");
  workout.exercises = next;
  workout.date = input.date;
  workout.note = input.note;
  if (
    !validState(state) ||
    new TextEncoder().encode(JSON.stringify(state)).length > 1024 * 1024
  )
    throw Error(
      "Check the workout date is within the program, exercise targets, and journal size.",
    );
  return state;
}
