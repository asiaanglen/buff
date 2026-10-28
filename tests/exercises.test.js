import test from "node:test";
import assert from "node:assert/strict";
import { searchExercises, exerciseCatalog } from "../shared/exercises.js";
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

test("every catalog exercise has a valid sourced YouTube default, including aliases", async () => {
  const { exerciseVideos, libraryExerciseVideo } =
    await import("../shared/exercise-videos.js");
  const { youtubeId } = await import("../shared/youtube.js");
  assert.equal(Object.keys(exerciseVideos).length, exerciseCatalog.length);
  for (const exercise of exerciseCatalog) {
    const video = libraryExerciseVideo(exercise.name);
    assert.ok(video, exercise.name);
    assert.ok(youtubeId(video.url), exercise.name);
    assert.ok(video.title.trim());
    assert.equal(new URL(video.source).hostname, "www.bing.com");
    for (const alias of exercise.aliases)
      assert.equal(libraryExerciseVideo(alias)?.url, video.url);
  }
  assert.equal(libraryExerciseVideo("My entirely custom exercise"), undefined);
  assert.match(exerciseVideos["barbell-bench-press"].creator, /megsquats/i);
  assert.match(
    exerciseVideos["single-leg-romanian-deadlift"].creator,
    /Girls Gone Strong/,
  );
  assert.match(exerciseVideos["barbell-lunge"].note, /barbell-specific/);
  assert.match(exerciseVideos["pull-up"].title, /Pull-Ups for Women/);
  assert.equal(
    exerciseVideos["pull-up"].url,
    "https://www.youtube.com/watch?v=YX9DF9xXquU",
  );
});
