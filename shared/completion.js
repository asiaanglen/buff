export function isWorkoutComplete(workout) {
  if (workout.skipped || workout.completionUndone) return false;
  const logs = workout.exercises.flatMap((e) => e.logs);
  return (
    workout.completed === true ||
    (logs.length > 0 && logs.every((log) => log.done))
  );
}
export function finishWorkout(workout) {
  delete workout.skipped;
  delete workout.completionUndone;
  workout.completed = true;
  const logs = workout.exercises.flatMap((e) => e.logs);
  return { done: logs.filter((log) => log.done).length, total: logs.length };
}

export function orderedProgramWorkouts(state, programId) {
  return state.workouts
    .filter((w) => w.programId === programId)
    .sort((a, b) => a.date.localeCompare(b.date));
}
export function nextProgramWorkout(state, programId = state.activeProgramId) {
  if (!programId) return null;
  return (
    orderedProgramWorkouts(state, programId).find(
      (w) => !w.skipped && !isWorkoutComplete(w),
    ) || null
  );
}
export function skipProgramWorkout(state, workoutId) {
  const workout = state.workouts.find((w) => w.id === workoutId);
  if (
    !workout ||
    !workout.programId ||
    workout.programId !== state.activeProgramId ||
    isWorkoutComplete(workout)
  )
    throw Error("Choose an unfinished workout in your active program.");
  workout.skipped = true;
  return workout;
}

export function reopenWorkout(workout) {
  if (!workout || !isWorkoutComplete(workout))
    throw Error("Choose a completed workout.");
  delete workout.completed;
  delete workout.skipped;
  // Preserve checked sets and results without immediately deriving completion again.
  workout.completionUndone = true;
  return workout;
}
