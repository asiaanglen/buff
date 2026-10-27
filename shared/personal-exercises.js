import { exerciseByName } from "./exercises.js";
export const personalExercise = (state, name) =>
  (state.customExercises || []).find(
    (e) => e.name.toLowerCase() === name.trim().toLowerCase(),
  );
export function applyDefinition(exercise, definition) {
  if (!definition) return exercise;
  exercise.customExerciseId = definition.id;
  exercise.instructions = definition.instructions;
  exercise.weighted = definition.weighted;
  if (!definition.weighted) exercise.weight = 0;
  delete exercise.libraryId;
  return exercise;
}
export function addPersonalExercise(state, input) {
  const name = input.name.trim(),
    instructions = input.instructions.trim();
  if (
    !name ||
    name.length > 100 ||
    !instructions ||
    instructions.length > 3000 ||
    !["reps", "time"].includes(input.mode) ||
    typeof input.weighted !== "boolean"
  )
    throw Error("Enter a name, instructions and tracking options.");
  if (exerciseByName(name) || personalExercise(state, name))
    throw Error(
      "An exercise with this name already exists. Choose it from the suggestions.",
    );
  if ((state.customExercises || []).length >= 1000)
    throw Error("Your personal library is full.");
  const definition = {
    id: crypto.randomUUID(),
    name,
    instructions,
    mode: input.mode,
    weighted: input.weighted,
  };
  const entries = [...(state.customExercises || []), definition];
  if (
    new TextEncoder().encode(
      JSON.stringify({ ...state, customExercises: entries }),
    ).length >
    1024 * 1024
  )
    throw Error("Your journal is full. This exercise could not be saved.");
  state.customExercises = entries;
  return definition;
}
