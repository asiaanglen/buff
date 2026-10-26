import { pounds, inPounds } from "../shared/weights.js";
import Papa from "papaparse";
import { exercise, uid, weekStart } from "./model.js";
import { programError, shiftDate } from "../shared/programs.js";
import { validState } from "../shared/journal.js";
export const TEMPLATE =
  "week,day,workout,exercise,sets,reps,seconds,weight_lbs,superset,workout_notes\n1,1,Upper body,Barbell bench press,4,8,,40,,Controlled reps\n1,1,Upper body,Dumbbell row,3,12,,16,A,\n1,1,Upper body,Shoulder press,3,10,,12,A,\n1,3,Core,Plank,3,,45,0,,\n2,1,Upper body,Barbell bench press,4,8,,42.5,,\n";
const aliases = {
  week: ["week", "weeknumber", "programweek"],
  day: ["day", "daynumber", "weekday"],
  workout: ["workout", "workoutname", "session"],
  exercise: ["exercise", "exercisename", "movement"],
  sets: ["sets", "numberofsets"],
  reps: ["reps", "repetitions", "targetreps"],
  seconds: [
    "seconds",
    "time",
    "duration",
    "timeseconds",
    "timesec",
    "durationseconds",
  ],
  weight: [
    "weight",
    "weightlbs",
    "weightlb",
    "lbs",
    "lb",
    "weightkg",
    "kg",
    "plannedweight",
  ],
  superset: ["superset", "supersetgroup", "group"],
  workout_notes: ["workoutnotes", "notes", "note"],
};
const normalize = (v) =>
  String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
const text = (v) => (v === null || v === undefined ? "" : String(v).trim());
const numbered = (v, label) => {
  const s = text(v).replace(new RegExp("^" + label + "\\s*", "i"), "");
  return s === "" ? NaN : Number(s);
};
export function csvRows(source) {
  const parsed = Papa.parse(source.replace(/^\ufeff/, ""), {
    skipEmptyLines: "greedy",
    preview: 2002,
  });
  if (parsed.errors.length)
    throw Error("CSV could not be read: " + parsed.errors[0].message);
  return parsed.data;
}
export function parseProgramRows(rows, options) {
  const errors = [];
  if (!Array.isArray(rows) || rows.length < 2)
    return {
      errors: [
        "The sheet must contain a header row and at least one exercise.",
      ],
    };
  if (rows.length > 2001)
    return { errors: ["Import up to 2,000 exercise rows at a time."] };
  const columns = new Map(),
    headers = rows[0].map(normalize);
  for (const [field, names] of Object.entries(aliases)) {
    const matches = headers
      .map((h, i) => (names.includes(h) ? i : -1))
      .filter((i) => i >= 0);
    if (matches.length > 1)
      errors.push(`Multiple columns match “${field}”. Keep only one.`);
    if (matches.length) columns.set(field, matches[0]);
  }
  for (const field of ["week", "exercise", "sets"])
    if (!columns.has(field)) errors.push(`Missing required column: ${field}.`);
  if (!columns.has("reps") && !columns.has("seconds"))
    errors.push("Include a reps or seconds column.");
  if (errors.length) return { errors };
  const maxWeek = Math.max(
    1,
    ...rows
      .slice(1)
      .map((r) => numbered(r[columns.get("week")], "week"))
      .filter(Number.isFinite),
  );
  const weeks = Number(options.weeks) || maxWeek;
  const program = {
    id: uid(),
    name: text(options.name),
    startDate: options.startDate || weekStart(),
    weeks,
    note: text(options.note),
  };
  const programIssue = programError(program);
  if (programIssue) errors.push(programIssue);
  if (programIssue) return { errors, inferredWeeks: maxWeek };
  const workouts = new Map();
  let previous = { week: NaN, day: 1, workout: "" },
    exerciseCount = 0;
  for (let index = 1; index < rows.length; index++) {
    const row = rows[index];
    if (row.every((v) => text(v) === "")) continue;
    const get = (field) => (columns.has(field) ? row[columns.get(field)] : "");
    try {
      let w = text(get("week")) ? numbered(get("week"), "week") : previous.week;
      if (!Number.isInteger(w) || w < 1 || w > weeks)
        throw Error(`Week must be a whole number between 1 and ${weeks}.`);
      let d;
      if (text(get("day")) === "") d = w === previous.week ? previous.day : 1;
      else {
        d = numbered(get("day"), "day");
        if (!Number.isFinite(d)) {
          const names = [
            ["mon", "monday"],
            ["tue", "tues", "tuesday"],
            ["wed", "wednesday"],
            ["thu", "thur", "thurs", "thursday"],
            ["fri", "friday"],
            ["sat", "saturday"],
            ["sun", "sunday"],
          ];
          const named = names.findIndex((list) =>
            list.includes(text(get("day")).toLowerCase()),
          );
          if (named >= 0) {
            const start =
              (new Date(program.startDate + "T12:00:00").getDay() + 6) % 7;
            d = ((named - start + 7) % 7) + 1;
          }
        }
      }
      if (!Number.isInteger(d) || d < 1 || d > 7)
        throw Error("Day must be 1–7 or a weekday name.");
      const workoutName =
        text(get("workout")) ||
        (w === previous.week && d === previous.day && previous.workout
          ? previous.workout
          : `Workout ${d}`);
      const exerciseName = text(get("exercise")),
        sets = Number(get("sets")),
        reps = text(get("reps")),
        seconds = text(get("seconds"));
      if (!exerciseName || exerciseName.length > 100)
        throw Error("Exercise name is required (up to 100 characters).");
      if (!Number.isInteger(sets) || sets < 1 || sets > 30)
        throw Error("Sets must be a whole number from 1 to 30.");
      if ((reps !== "" && seconds !== "") || (reps === "" && seconds === ""))
        throw Error("Enter reps OR seconds for each exercise, not both.");
      const target = Number(reps || seconds);
      if (!Number.isInteger(target) || target < 1 || target > 10000)
        throw Error("Reps or seconds must be a whole number from 1 to 10,000.");
      let weight = text(get("weight")) === "" ? 0 : Number(get("weight"));
      if (
        !Number.isFinite(weight) ||
        weight < 0 ||
        weight >
          (["weightkg", "kg"].includes(headers[columns.get("weight")])
            ? 2000
            : 5000)
      )
        throw Error(
          "Weight must be a nonnegative number up to 5,000 lbs (or 2,000 kg in a weight_kg column).",
        );
      if (["weightkg", "kg"].includes(headers[columns.get("weight")]))
        weight = pounds(weight);
      const group = text(get("superset")).toUpperCase(),
        note = text(get("workout_notes"));
      if (workoutName.length > 100 || note.length > 500 || group.length > 12)
        throw Error("A workout name, note, or superset label is too long.");
      const key = JSON.stringify([w, d, workoutName]);
      let workout = workouts.get(key);
      if (!workout) {
        workout = {
          id: uid(),
          programId: program.id,
          name: workoutName,
          date: shiftDate(program.startDate, (w - 1) * 7 + d - 1),
          note,
          exercises: [],
        };
        workouts.set(key, workout);
      } else if (note && workout.note && note !== workout.note)
        throw Error(
          "Rows for the same workout have conflicting workout notes.",
        );
      else if (note) workout.note = note;
      if (workout.exercises.length >= 200)
        throw Error("A workout can contain at most 200 exercises.");
      workout.exercises.push(
        exercise(
          exerciseName,
          sets,
          target,
          seconds !== "" ? "time" : "reps",
          weight,
          group,
        ),
      );
      exerciseCount++;
      previous = { week: w, day: d, workout: workoutName };
    } catch (e) {
      errors.push(`Row ${index + 1}: ${e.message}`);
    }
  }
  if (!exerciseCount && !errors.length)
    errors.push("No exercise rows were found.");
  for (const w of workouts.values()) {
    const order = new Map();
    for (const e of w.exercises) {
      const k = e.group || e.id;
      if (!order.has(k)) order.set(k, order.size);
    }
    w.exercises.sort(
      (a, b) => order.get(a.group || a.id) - order.get(b.group || b.id),
    );
  }
  return {
    program,
    workouts: [...workouts.values()],
    exerciseCount,
    errors,
    inferredWeeks: maxWeek,
  };
}
export function validateXlsxArchive(buffer) {
  const v = new DataView(buffer);
  let end = -1;
  for (let p = v.byteLength - 22; p >= Math.max(0, v.byteLength - 65557); p--)
    if (v.getUint32(p, true) === 0x06054b50) {
      end = p;
      break;
    }
  if (end < 0) throw Error("This is not a valid .xlsx file.");
  const entries = v.getUint16(end + 10, true);
  let pos = v.getUint32(end + 16, true),
    total = 0;
  if (entries > 256)
    throw Error(
      "The workbook has too many internal files. Use a smaller workbook.",
    );
  for (let i = 0; i < entries; i++) {
    if (pos + 46 > v.byteLength || v.getUint32(pos, true) !== 0x02014b50)
      throw Error("The workbook archive is damaged.");
    const size = v.getUint32(pos + 24, true);
    total += size;
    if (total > 20 * 1024 * 1024 || v.getUint16(pos + 8, true) & 1)
      throw Error(
        "Use an unencrypted workbook with less than 20 MB of expanded content.",
      );
    pos +=
      46 +
      v.getUint16(pos + 28, true) +
      v.getUint16(pos + 30, true) +
      v.getUint16(pos + 32, true);
  }
}
export function appendImportedProgram(state, parsed) {
  if (parsed.errors?.length || !parsed.program || !parsed.workouts?.length)
    throw Error("Resolve the import errors before importing.");
  const next = inPounds(structuredClone(state));
  next.programs ||= [];
  next.programs.push(parsed.program);
  next.workouts.push(...parsed.workouts);
  if (!validState(next))
    throw Error("This import exceeds your journal’s limits.");
  if (new TextEncoder().encode(JSON.stringify(next)).length > 1000000)
    throw Error(
      "This import would exceed the 1 MB cloud journal limit. Split or shorten the program.",
    );
  return next;
}
