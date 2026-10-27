import { validDate, programWeek, shiftDate } from "./programs.js";
export function monthDates(date) {
  if (!validDate(date)) throw Error("Choose a valid calendar date.");
  const first = date.slice(0, 7) + "-01";
  const weekday = new Date(first + "T00:00:00Z").getUTCDay();
  const start = shiftDate(first, -((weekday + 6) % 7));
  return Array.from({ length: 42 }, (_, index) => shiftDate(start, index));
}
export function shiftMonth(date, offset) {
  const d = new Date(date.slice(0, 7) + "-01T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + offset);
  return d.toISOString().slice(0, 10);
}
export function moveWorkout(state, workoutId, date) {
  if (!validDate(date)) throw Error("Choose a valid workout date.");
  const workout = state.workouts.find((workout) => workout.id === workoutId);
  if (!workout) throw Error("This workout is no longer in your planner.");
  if (workout.programId) {
    const program = (state.programs || []).find(
      (program) => program.id === workout.programId,
    );
    if (
      !program ||
      programWeek(program, date) < 1 ||
      programWeek(program, date) > program.weeks
    )
      throw Error(
        "Choose a date within this program’s date range, or align the program to move its whole schedule.",
      );
  }
  workout.date = date;
  return workout;
}
