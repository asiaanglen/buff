export const MAX_PROGRAM_WEEKS = 5200;
export function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(value + "T00:00:00Z");
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
export function shiftDate(date, days) {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function daysApart(a, b) {
  return Math.round(
    (Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000,
  );
}
export function programWeek(program, date) {
  return Math.floor(daysApart(program.startDate, date) / 7) + 1;
}
export function programEnd(program) {
  return shiftDate(program.startDate, program.weeks * 7 - 1);
}
export function programError(program, workouts = []) {
  if (
    typeof program.name !== "string" ||
    !program.name.trim() ||
    program.name.length > 100
  )
    return "Enter a program name (up to 100 characters).";
  if (
    !Number.isInteger(program.weeks) ||
    program.weeks < 1 ||
    program.weeks > MAX_PROGRAM_WEEKS
  )
    return `Choose a whole number of weeks from 1 to ${MAX_PROGRAM_WEEKS}.`;
  if (!validDate(program.startDate) || !validDate(programEnd(program)))
    return "Choose a valid start date and program duration.";
  if (
    workouts.some(
      (w) =>
        w.programId === program.id &&
        (programWeek(program, w.date) < 1 ||
          programWeek(program, w.date) > program.weeks),
    )
  )
    return "This date range would leave assigned workouts outside the program. Expand the range or move those workouts first. Their logs will be kept.";
  return "";
}

export function programHasResults(programId, workouts) {
  return workouts.some(
    (workout) =>
      workout.programId === programId &&
      workout.exercises.some((exercise) =>
        exercise.logs.some(
          (log) => log.done || log.weight !== "" || log.actual !== "",
        ),
      ),
  );
}
export function alignProgram(state, programId, startDate) {
  const program = (state.programs || []).find(
    (program) => program.id === programId,
  );
  if (!program || !validDate(startDate))
    throw Error("Choose a valid program and start date.");
  const offset = daysApart(program.startDate, startDate);
  if (offset && programHasResults(programId, state.workouts))
    throw Error(
      "This program has recorded results. Keep its start date to preserve workout history; reschedule upcoming workouts individually in Weekly planner.",
    );
  const nextProgram = { ...program, startDate };
  const shifted = state.workouts.map((workout) =>
    workout.programId === programId
      ? { ...workout, date: shiftDate(workout.date, offset) }
      : workout,
  );
  const error = programError(nextProgram, shifted);
  if (error) throw Error(error);
  // Validate every new date before mutating any of the user's existing records.
  program.startDate = startDate;
  state.workouts.forEach((workout, index) => {
    if (workout.programId === programId) workout.date = shifted[index].date;
  });
  return program;
}
