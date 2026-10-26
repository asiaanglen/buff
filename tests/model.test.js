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
