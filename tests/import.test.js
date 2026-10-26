import { test } from "node:test";
import assert from "node:assert/strict";
import {
  csvRows,
  parseProgramRows,
  TEMPLATE,
  appendImportedProgram,
  validateXlsxArchive,
} from "../src/program-import.js";
import { initialState } from "../src/model.js";
import { readFileSync } from "node:fs";
const options = { name: "Imported build", startDate: "2026-11-02" };
test("CSV imports numbered weeks, quoted names, supersets, timed exercises and blank group cells", () => {
  const rows = csvRows(
    'week,day,workout,exercise,sets,reps,seconds,weight,superset\n1,1,Upper,"Row, one arm",3,12,,16,A\n,,Upper,Press,3,10,,12,A\n2,3,Core,Plank,3,,45,0,\n',
  );
  const parsed = parseProgramRows(rows, options);
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.program.weeks, 2);
  assert.equal(parsed.workouts.length, 2);
  assert.equal(parsed.workouts[0].exercises[0].name, "Row, one arm");
  assert.equal(parsed.workouts[0].exercises[1].group, "A");
  assert.equal(parsed.workouts[1].date, "2026-11-11");
  assert.equal(parsed.workouts[1].exercises[0].mode, "time");
  assert.equal(parsed.workouts[1].exercises[0].logs[0].done, false);
});
test("invalid rows are reported and never partially appended", () => {
  const parsed = parseProgramRows(
    csvRows("week,exercise,sets,reps,seconds\n1,Squat,3,8,45\n2,Plank,0,,45"),
    options,
  );
  assert.equal(parsed.errors.length, 2);
  assert.match(parsed.errors[0], /Row 2/);
  const state = initialState();
  assert.throws(() => appendImportedProgram(state, parsed), /Resolve/);
  assert.equal(state.workouts.length, 1);
});
test("template imports preserve existing workouts and reject out-of-range weeks", () => {
  const parsed = parseProgramRows(csvRows(TEMPLATE), options);
  assert.equal(parsed.errors.length, 0);
  const state = initialState(),
    next = appendImportedProgram(state, parsed);
  assert.equal(state.programs.length, 0);
  assert.equal(next.workouts[0].id, state.workouts[0].id);
  assert.equal(next.programs.length, 1);
  assert.ok(
    parseProgramRows(csvRows(TEMPLATE), { ...options, weeks: 1 }).errors.some(
      (e) => /Row/.test(e),
    ),
  );
});
test("XLSX archive preflight accepts the fixture and rejects invalid compressed input", () => {
  const b = readFileSync(new URL("./fixtures/program.xlsx", import.meta.url));
  validateXlsxArchive(
    b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
  );
  assert.throws(() => validateXlsxArchive(new ArrayBuffer(30)), /valid .xlsx/);
});

test("CSV weights default to pounds and explicit kg columns convert before preview", () => {
  const lbs = parseProgramRows(
    csvRows("week,exercise,sets,reps,weight_lbs\n1,Squat,3,8,135"),
    options,
  );
  assert.equal(lbs.workouts[0].exercises[0].weight, 135);
  const kg = parseProgramRows(
    csvRows("week,exercise,sets,reps,weight_kg\n1,Squat,3,8,40"),
    options,
  );
  assert.equal(kg.workouts[0].exercises[0].weight, 88.18);
  assert.equal(appendImportedProgram(initialState(), kg).unit, "lbs");
});
