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

test("every library movement has a usable guide and exact alias matching keeps variations separate", async () => {
  const { exerciseCatalog, exerciseByName } =
    await import("../shared/exercises.js");
  assert.equal(exerciseCatalog.length, 155);
  for (const exercise of exerciseCatalog) {
    assert.equal(exercise.instructions.steps.length, 3, exercise.name);
    assert.ok(
      exercise.instructions.steps.every((step) => step.trim().length > 15),
      exercise.name,
    );
    assert.ok(exercise.instructions.cues.length > 0, exercise.name);
  }
  assert.equal(exerciseByName("barbell back squat").name, "Back Squat");
  assert.equal(exerciseByName("RDL").name, "Romanian Deadlift");
  assert.equal(exerciseByName("squat"), undefined);
});

test("cable kickbacks and split squats have their own searchable library entries and instructions", async () => {
  const { exerciseByName } = await import("../shared/exercises.js");
  assert.equal(exerciseByName("Cable Kickbacks").id, "cable-kickback");
  assert.equal(
    searchExercises({ query: "split squats" }).exercises[0].id,
    "split-squat",
  );
  assert.match(
    exerciseByName("Cable Kickback").instructions.steps[0],
    /ankle strap/,
  );
  assert.match(
    exerciseByName("Split Squat").instructions.steps[0],
    /both feet on the floor/,
  );
  assert.notEqual(
    exerciseByName("Split Squat").id,
    exerciseByName("Bulgarian Split Squat").id,
  );
});
