export function isWorkoutComplete(workout) {
  const logs = workout.exercises.flatMap((e) => e.logs);
  return (
    workout.completed === true ||
    (logs.length > 0 && logs.every((log) => log.done))
  );
}
export function finishWorkout(workout) {
  workout.completed = true;
  const logs = workout.exercises.flatMap((e) => e.logs);
  return { done: logs.filter((log) => log.done).length, total: logs.length };
}
