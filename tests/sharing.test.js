import test from "node:test";
import assert from "node:assert/strict";
import {
  snapshotProgram,
  copySharedProgram,
} from "../shared/program-sharing.js";
import { exercise } from "../src/model.js";
import { validState } from "../shared/journal.js";
test("sharing copies only a program plan, gives every instance a new ID and never carries results or exercise notes", () => {
  const entry = exercise("Back Squat", 2, 5, "reps", 95, "A");
  entry.logs[0] = { weight: "175", actual: "3", done: true };
  entry.note = "PRIVATE EXERCISE NOTE";
  const state = {
    version: 1,
    unit: "lbs",
    displayName: "Alex",
    programs: [
      {
        id: "source",
        name: "Shared strength",
        weeks: 4,
        startDate: "2026-10-26",
        note: "Plan note",
      },
    ],
    workouts: [
      {
        id: "source-workout",
        programId: "source",
        name: "Lower",
        date: "2026-10-28",
        note: "Workout plan note",
        exercises: [entry],
      },
      {
        id: "private-workout",
        name: "PRIVATE OTHER WORKOUT",
        date: "2026-10-26",
        note: "PRIVATE",
        exercises: [],
      },
    ],
  };
  const snapshot = snapshotProgram(state, "source");
  const serialized = JSON.stringify(snapshot);
  assert.ok(!serialized.includes("PRIVATE"));
  assert.ok(!serialized.includes("175"));
  assert.ok(!serialized.includes("source-workout"));
  const destination = {
    version: 1,
    unit: "lbs",
    programs: [],
    workouts: [
      {
        id: "existing",
        name: "Keep me",
        date: "2026-11-02",
        note: "",
        exercises: [],
      },
    ],
  };
  const copy = copySharedProgram(destination, snapshot, "2026-11-02");
  assert.equal(copy.state.programs[0].startDate, "2026-11-02");
  assert.equal(copy.state.workouts[1].date, "2026-11-04");
  assert.equal(copy.state.workouts[1].exercises[0].weight, 95);
  assert.equal(copy.state.workouts[1].exercises[0].note, undefined);
  assert.deepEqual(copy.state.workouts[1].exercises[0].logs, [
    { weight: "", actual: "", done: false },
    { weight: "", actual: "", done: false },
  ]);
  assert.notEqual(copy.state.workouts[1].exercises[0].id, entry.id);
  assert.notEqual(copy.state.programs[0].id, "source");
  assert.equal(copy.state.workouts[0].id, "existing");
  assert.equal(validState(copy.state), true);
  assert.equal(destination.programs.length, 0);
  assert.equal(state.workouts[0].exercises[0].logs[0].weight, "175");
});
