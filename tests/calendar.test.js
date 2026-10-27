import test from "node:test";
import assert from "node:assert/strict";
import { monthDates, shiftMonth, moveWorkout } from "../shared/calendar.js";
import { exercise } from "../src/model.js";
import { validState } from "../shared/journal.js";
test("month calendars start on Monday, include leap days, and navigate year boundaries", () => {
  const dates = monthDates("2024-02-20");
  assert.equal(dates.length, 42);
  assert.equal(dates[0], "2024-01-29");
  assert.ok(dates.includes("2024-02-29"));
  assert.equal(shiftMonth("2026-12-31", 1), "2027-01-01");
  assert.equal(shiftMonth("2026-01-31", -1), "2025-12-01");
});
test("moving logged workouts keeps their identity and history and rejects out-of-program dates atomically", () => {
  const entry = exercise("Back Squat", 1, 5, "reps", 95);
  entry.logs[0] = { weight: "100", actual: "5", done: true };
  entry.note = "Keep my note";
  const state = {
    version: 1,
    unit: "lbs",
    programs: [
      { id: "p", name: "Plan", weeks: 4, startDate: "2026-10-26", note: "" },
    ],
    workouts: [
      {
        id: "w",
        programId: "p",
        name: "Logged",
        date: "2026-10-26",
        note: "Keep workout note",
        exercises: [entry],
      },
    ],
  };
  const before = structuredClone(state);
  assert.throws(() => moveWorkout(state, "w", "2026-10-25"), /program/);
  assert.throws(() => moveWorkout(state, "w", "2026-11-23"), /program/);
  assert.throws(() => moveWorkout(state, "w", "2026-02-30"), /valid/);
  assert.deepEqual(state, before);
  moveWorkout(state, "w", "2026-11-01");
  assert.deepEqual(state.workouts[0], {
    ...before.workouts[0],
    date: "2026-11-01",
  });
  assert.equal(validState(state), true);
});
