import { exerciseByName } from "./exercises.js";

const identity = (e) =>
  e.customExerciseId
    ? "custom:" + e.customExerciseId
    : "library:" +
      (exerciseByName(e.name)?.id ||
        e.libraryId ||
        e.name.trim().toLowerCase());

export function futureSwapTargets(state, current, original, today) {
  if (!current.programId) return [];
  const key = identity(original);
  return state.workouts
    .filter(
      (w) =>
        w.id !== current.id &&
        w.programId === current.programId &&
        w.date > current.date &&
        w.date >= today,
    )
    .flatMap((w) =>
      w.exercises.filter(
        (e) =>
          identity(e) === key &&
          !e.note &&
          e.logs.every((l) => !l.done && l.weight === "" && l.actual === ""),
      ),
    );
}

export function swapFutureExercises(
  state,
  current,
  original,
  replacement,
  today,
) {
  const targets = futureSwapTargets(state, current, original, today);
  for (const e of targets) {
    const previousMode = e.mode;
    for (const field of [
      "libraryId",
      "customExerciseId",
      "instructions",
      "weighted",
      "videoUrl",
    ]) {
      delete e[field];
      if (replacement[field] !== undefined) e[field] = replacement[field];
    }
    e.name = replacement.name;
    e.mode = replacement.mode;
    if (previousMode !== e.mode) e.target = replacement.target;
    if (e.weighted === false) e.weight = 0;
    // Each later workout keeps its own progression, order, sets, and superset.
  }
  return targets.length;
}
