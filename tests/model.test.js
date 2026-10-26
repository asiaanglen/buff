import { test } from "node:test";
import assert from "node:assert/strict";
import { weekStart, addDays, exercise, progress } from "../src/model.js";
test("week navigation handles Sundays and year boundaries", () => {
  assert.equal(weekStart(new Date("2027-01-03T12:00:00")), "2026-12-28");
  assert.equal(addDays("2026-12-28", 7), "2027-01-04");
});
test("each set has independent logging state and progress reflects completion", () => {
  const e = exercise("Squat", 3, 8);
  e.logs[0].done = true;
  assert.equal(e.logs[1].done, false);
  assert.deepEqual(progress({ exercises: [e] }), { total: 3, done: 1 });
});

import {
  initialState,
  copyProgramWeek,
  programWeek,
  programError,
  importGuest,
} from "../src/model.js";
import { validState } from "../shared/journal.js";
test("program weeks cross daylight-saving and year boundaries correctly", () => {
  const p = {
    id: "p",
    name: "Build",
    startDate: "2026-03-02",
    weeks: 10,
    note: "",
  };
  assert.equal(programWeek(p, "2026-03-08"), 1);
  assert.equal(programWeek(p, "2026-03-09"), 2);
  const year = { ...p, startDate: "2026-11-02" };
  assert.equal(programWeek(year, "2027-01-04"), 10);
  assert.equal(
    programError({ ...p, weeks: 0 }),
    "Choose a whole number of weeks from 1 to 5200.",
  );
});
test("legacy journals remain valid and program links and bounds are validated", () => {
  const state = initialState();
  delete state.programs;
  assert.equal(validState(state), true);
  const p = {
    id: "p",
    name: "Build",
    startDate: state.workouts[0].date,
    weeks: 10,
    note: "",
  };
  state.programs = [p];
  state.workouts[0].programId = p.id;
  assert.equal(validState(state), true);
  state.workouts[0].date = "2027-01-04";
  p.startDate = "2026-11-02";
  assert.equal(validState(state), true);
  assert.match(
    programError({ ...p, weeks: 4 }, state.workouts),
    /outside the program/,
  );
  p.weeks = 4;
  assert.equal(validState(state), false);
  p.weeks = 10;
  state.workouts[0].programId = "missing";
  assert.equal(validState(state), false);
});
test("copying a program week preserves plans and supersets while resetting independent logs", () => {
  const state = initialState();
  const original = state.workouts[0];
  state.programs = [
    { id: "p", name: "Build", startDate: original.date, weeks: 4, note: "" },
  ];
  original.programId = "p";
  original.exercises[0].logs[0] = { weight: "40", actual: "8", done: true };
  const [copy] = copyProgramWeek(state, "p", 1, 2);
  assert.notEqual(copy.id, original.id);
  assert.equal(programWeek(state.programs[0], copy.date), 2);
  assert.equal(copy.exercises[1].group, "A");
  assert.equal(copy.exercises[0].target, 8);
  assert.notEqual(copy.exercises[0].id, original.exercises[0].id);
  assert.equal(copy.exercises[0].logs[0].done, false);
  assert.equal(original.exercises[0].logs[0].done, true);
  assert.equal(validState(state), true);
  assert.throws(() => copyProgramWeek(state, "p", 1, 1), /different week/);
});
test("importing guest programs remaps colliding program IDs without changing existing history", () => {
  const current = initialState();
  const guest = initialState();
  const p = {
    id: "shared",
    name: "Cloud program",
    startDate: guest.workouts[0].date,
    weeks: 4,
    note: "",
  };
  current.programs = [p];
  guest.programs = [{ ...p, name: "Guest program" }];
  guest.workouts[0].programId = p.id;
  const imported = importGuest(current, guest);
  assert.equal(imported.programs, 1);
  assert.equal(imported.workouts, 1);
  assert.equal(current.programs.length, 1);
  assert.equal(imported.state.programs[0].name, "Cloud program");
  assert.notEqual(imported.state.workouts[1].programId, "shared");
  assert.equal(validState(imported.state), true);
});

import { previousExercisePerformance } from "../src/model.js";
test("exercise history uses the newest completed matching session across programs and preserves per-set results", () => {
  const current = {
    id: "current",
    date: "2026-11-10",
    exercises: [exercise("  BENCH   PRESS ", 3, 8)],
  };
  const older = exercise("Bench press", 3, 10);
  older.logs[0] = { weight: "40", actual: "10", done: true };
  const recent = exercise("bench press", 3, 8);
  recent.logs[0] = { weight: "42.5", actual: "8", done: true };
  recent.logs[2] = { weight: "40", actual: "7", done: true };
  const state = {
    workouts: [
      { id: "old", date: "2026-11-01", name: "Old", exercises: [older] },
      {
        id: "recent",
        date: "2026-11-08",
        name: "Other program",
        exercises: [recent],
      },
      current,
      { id: "future", date: "2026-11-12", name: "Future", exercises: [older] },
    ],
  };
  const history = previousExercisePerformance(
    state,
    current,
    current.exercises[0],
  );
  assert.equal(history.date, "2026-11-08");
  assert.deepEqual(history.latest, { setNumber: 3, weight: 40, actual: 7 });
  assert.equal(history.sets[0].weight, 42.5);
  assert.equal(
    history.sets.find((s) => s.setNumber === 2),
    undefined,
  );
  recent.logs.forEach((l) => (l.done = false));
  assert.equal(
    previousExercisePerformance(state, current, current.exercises[0]).date,
    "2026-11-01",
  );
});
test("exercise history keeps time and rep tracking separate and includes zero-weight completed sets", () => {
  const current = {
    id: "current",
    date: "2026-11-10",
    exercises: [exercise("Plank", 3, 45, "time")],
  };
  const prior = exercise("Plank", 3, 45, "time");
  prior.logs[0] = { weight: "0", actual: "45", done: true };
  const state = {
    workouts: [
      { id: "past", date: "2026-11-09", name: "Core", exercises: [prior] },
      current,
    ],
  };
  assert.equal(
    previousExercisePerformance(state, current, current.exercises[0]).latest
      .weight,
    0,
  );
  assert.equal(
    previousExercisePerformance(
      state,
      current,
      exercise("Plank", 3, 10, "reps"),
    ),
    null,
  );
  assert.equal(
    previousExercisePerformance(state, current, exercise("New exercise")),
    null,
  );
});

import { inPounds } from "../src/model.js";
test("legacy kg journals convert planned and actual weights once while preserving reps, time and history", () => {
  const legacy = initialState();
  legacy.unit = "kg";
  legacy.workouts[0].exercises[0].weight = 40;
  legacy.workouts[0].exercises[0].logs[0] = {
    weight: "42.5",
    actual: "8",
    done: true,
  };
  legacy.workouts[0].exercises[3].logs[0] = {
    weight: "0",
    actual: "45",
    done: true,
  };
  const converted = inPounds(legacy);
  assert.equal(converted.unit, "lbs");
  assert.equal(converted.workouts[0].exercises[0].weight, 88.18);
  assert.equal(converted.workouts[0].exercises[0].logs[0].weight, "93.7");
  assert.equal(converted.workouts[0].exercises[0].logs[0].actual, "8");
  assert.equal(converted.workouts[0].exercises[3].logs[0].weight, "0");
  assert.equal(converted.workouts[0].exercises[3].logs[0].actual, "45");
  assert.equal(converted.workouts[0].exercises[0].logs[1].weight, "");
  assert.equal(converted.workouts[0].id, legacy.workouts[0].id);
  assert.equal(legacy.unit, "kg");
  assert.equal(legacy.workouts[0].exercises[0].weight, 40);
  assert.equal(inPounds(converted), converted);
  assert.equal(validState(converted), true);
});
