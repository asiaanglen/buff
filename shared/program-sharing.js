import { personalExercise, applyDefinition } from "./personal-exercises.js";
import { exercise, uid } from "../src/model.js";
import { daysApart, shiftDate, validDate } from "./programs.js";
import { validState } from "./journal.js";
import { inPounds } from "./weights.js";
export function snapshotProgram(journal, programId) {
  const state = inPounds(journal);
  const program = (state.programs || []).find(
    (program) => program.id === programId,
  );
  if (!program || !validState(state))
    throw Error("Program not found in your saved journal.");
  return {
    version: 1,
    program: { name: program.name, weeks: program.weeks, note: program.note },
    workouts: state.workouts
      .filter((workout) => workout.programId === programId)
      .map((workout) => ({
        name: workout.name,
        note: workout.note,
        offset: daysApart(program.startDate, workout.date),
        exercises: workout.exercises.map((entry) => ({
          name: entry.name,
          sets: entry.sets,
          target: entry.target,
          mode: entry.mode,
          weight: entry.weight,
          group: entry.group,
          ...(entry.instructions ||
          personalExercise(state, entry.name)?.instructions
            ? {
                instructions:
                  entry.instructions ||
                  personalExercise(state, entry.name).instructions,
                weighted:
                  entry.weighted ??
                  personalExercise(state, entry.name)?.weighted ??
                  true,
              }
            : {}),
        })),
      })),
  };
}
export function copySharedProgram(journal, snapshot, startDate) {
  if (!validDate(startDate)) throw Error("Choose a valid start date.");
  const state = journal
    ? inPounds(structuredClone(journal))
    : { version: 1, unit: "lbs", programs: [], workouts: [] };
  state.programs ||= [];
  const program = { id: uid(), ...snapshot.program, startDate };
  const workouts = snapshot.workouts.map((workout) => ({
    id: uid(),
    programId: program.id,
    name: workout.name,
    note: workout.note,
    date: shiftDate(startDate, workout.offset),
    exercises: workout.exercises.map((entry) => {
      const e = exercise(
        entry.name,
        entry.sets,
        entry.target,
        entry.mode,
        entry.weight,
        entry.group,
      );
      if (entry.instructions) {
        state.customExercises ||= [];
        let definition = personalExercise(state, entry.name);
        if (!definition) {
          definition = {
            id: uid(),
            name: entry.name,
            mode: entry.mode,
            instructions: entry.instructions,
            weighted: entry.weighted !== false,
          };
          state.customExercises.push(definition);
        }
        applyDefinition(e, {
          ...definition,
          instructions: entry.instructions,
          weighted: entry.weighted !== false,
        });
      }
      return e;
    }),
  }));
  state.programs.push(program);
  state.workouts.push(...workouts);
  if (
    !validState(state) ||
    new TextEncoder().encode(JSON.stringify(state)).length > 1024 * 1024
  )
    throw Error("Your journal does not have room for this program.");
  return { state, programId: program.id };
}
