import test from "node:test";
import assert from "node:assert/strict";
import {
  addPersonalExercise,
  applyDefinition,
  personalExercise,
} from "../shared/personal-exercises.js";
import { validState } from "../shared/journal.js";
import {
  snapshotProgram,
  copySharedProgram,
} from "../shared/program-sharing.js";
import { exercise } from "../src/model.js";
test("personal definitions validate, reject duplicate names, and share only exercises used in the plan", () => {
  const state = {
    version: 1,
    unit: "lbs",
    programs: [
      { id: "p", name: "My plan", weeks: 1, startDate: "2026-10-26", note: "" },
    ],
    workouts: [],
  };
  const def = addPersonalExercise(state, {
    name: "My balance",
    instructions: "Brace and hold.",
    mode: "time",
    weighted: false,
  });
  addPersonalExercise(state, {
    name: "Unused private lift",
    instructions: "Private instructions",
    mode: "reps",
    weighted: true,
  });
  assert.equal(personalExercise(state, "MY BALANCE"), def);
  assert.throws(
    () => addPersonalExercise(state, { ...def, name: "my balance" }),
    /already exists/,
  );
  assert.throws(
    () => addPersonalExercise(state, { ...def, name: "RDL" }),
    /already exists/,
  );
  assert.throws(() =>
    addPersonalExercise(state, { ...def, name: "New", instructions: " " }),
  );
  const e = applyDefinition(exercise(def.name, 2, 30, "time", 90), def);
  e.note = "Private session note";
  e.logs[0] = { weight: "0", actual: "29", done: true };
  state.workouts.push({
    id: "w",
    programId: "p",
    name: "Balance",
    date: "2026-10-26",
    note: "",
    exercises: [e],
  });
  assert.equal(e.weight, 0);
  assert.equal(validState(state), true);
  const snapshot = snapshotProgram(state, "p");
  assert.ok(!JSON.stringify(snapshot).includes("Unused private lift"));
  assert.ok(!JSON.stringify(snapshot).includes("Private session note"));
  const { state: recipient } = copySharedProgram(null, snapshot, "2026-11-02");
  assert.equal(recipient.customExercises.length, 1);
  assert.notEqual(recipient.customExercises[0].id, def.id);
  assert.equal(
    recipient.workouts[0].exercises[0].instructions,
    def.instructions,
  );
  assert.equal(recipient.workouts[0].exercises[0].weighted, false);
  assert.equal(recipient.workouts[0].exercises[0].logs[0].done, false);
  assert.equal(validState(recipient), true);
  const invalid = structuredClone(state);
  invalid.customExercises[0].weighted = "false";
  assert.equal(validState(invalid), false);
});

test("YouTube links normalize safely and reject executable or unrelated URLs", async () => {
  const { youtubeUrl } = await import("../shared/youtube.js");
  for (const url of [
    "https://youtu.be/rT7DgCr-3pg?t=30",
    "https://www.youtube.com/watch?v=rT7DgCr-3pg&list=ignored",
    "https://www.youtube.com/shorts/rT7DgCr-3pg",
  ]) {
    assert.equal(
      youtubeUrl(url),
      "https://www.youtube.com/watch?v=rT7DgCr-3pg",
    );
  }
  for (const url of [
    "javascript:alert(1)",
    "https://youtube.com.attacker.test/watch?v=rT7DgCr-3pg",
    "https://attacker.test",
    "https://youtube.com/watch?v=bad",
    "http://youtube.com/watch?v=rT7DgCr-3pg",
    "https://me@youtube.com/watch?v=rT7DgCr-3pg",
  ])
    assert.equal(youtubeUrl(url), null);
  const state = { version: 1, unit: "lbs", workouts: [] };
  const item = addPersonalExercise(state, {
    name: "Test video exercise",
    instructions: "Move carefully.",
    mode: "reps",
    weighted: true,
    videoUrl: "https://youtu.be/rT7DgCr-3pg",
  });
  assert.equal(
    applyDefinition(exercise(item.name), item).videoUrl,
    item.videoUrl,
  );
  assert.equal(
    validState({
      ...state,
      exerciseVideos: { "test exercise": item.videoUrl },
    }),
    true,
  );
  assert.equal(
    validState({
      ...state,
      exerciseVideos: { "test exercise": "https://attacker.test" },
    }),
    false,
  );
});
