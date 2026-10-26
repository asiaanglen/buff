import test from "node:test";
import assert from "node:assert/strict";
import { searchExercises } from "../shared/exercises.js";
test("exercise search handles common aliases and punctuation while keeping variations distinct", () => {
  assert.ok(
    searchExercises({ query: "RDL" }).exercises.some(
      (e) => e.name === "Romanian Deadlift",
    ),
  );
  assert.deepEqual(
    searchExercises({ query: "neutral grip pull-up" }).exercises.map(
      (e) => e.name,
    ),
    ["Neutral Grip Pull Up"],
  );
  assert.ok(
    searchExercises({ query: "squat" }).exercises.some(
      (e) => e.name === "Front Squat",
    ),
  );
  assert.ok(
    searchExercises({ query: "squat" }).exercises.some(
      (e) => e.name === "Back Squat",
    ),
  );
  assert.deepEqual(searchExercises({ query: "not a real movement" }), {
    exercises: [],
    total: 0,
  });
});
test("exercise catalog supports filtered paging and distinguishes rep and time tracking", () => {
  const results = searchExercises({
    category: "Core",
    equipment: "Bodyweight",
    limit: 1,
  });
  assert.equal(results.exercises.length, 1);
  assert.ok(results.total > 1);
  assert.notEqual(
    searchExercises({
      category: "Core",
      equipment: "Bodyweight",
      limit: 1,
      offset: 1,
    }).exercises[0].id,
    results.exercises[0].id,
  );
  assert.equal(
    searchExercises({ query: "plank" }).exercises.find(
      (e) => e.name === "Plank",
    ).mode,
    "time",
  );
  assert.equal(
    searchExercises({ query: "Russian Twists" }).exercises[0].mode,
    "reps",
  );
});
