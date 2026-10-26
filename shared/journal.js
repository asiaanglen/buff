import { programError, programWeek, validDate } from "./programs.js";
export function validState(s) {
  const text = (v, n) => typeof v === "string" && v.length <= n;
  const num = (v, max) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max;
  const logNum = (v, max) =>
    v === "" ||
    ((typeof v === "string" || typeof v === "number") &&
      String(v).trim() !== "" &&
      num(Number(v), max));
  if (
    !s ||
    s.version !== 1 ||
    !["kg", "lbs"].includes(s.unit) ||
    !Array.isArray(s.workouts) ||
    s.workouts.length > 5000
  )
    return false;
  if (
    s.programs !== undefined &&
    (!Array.isArray(s.programs) || s.programs.length > 500)
  )
    return false;
  if (
    s.activeProgramId !== undefined &&
    s.activeProgramId !== null &&
    !text(s.activeProgramId, 100)
  )
    return false;
  const programs = new Map();
  for (const p of s.programs || []) {
    if (
      !p ||
      !text(p.id, 100) ||
      !p.id ||
      programs.has(p.id) ||
      !text(p.note, 500) ||
      programError(p)
    )
      return false;
    programs.set(p.id, p);
  }
  const ids = new Set();
  return s.workouts.every((w) => {
    if (
      !w ||
      !text(w.id, 100) ||
      ids.has(w.id) ||
      !text(w.name, 100) ||
      !w.name.trim() ||
      !text(w.note, 500) ||
      !validDate(w.date) ||
      !Array.isArray(w.exercises) ||
      w.exercises.length > 200
    )
      return false;
    if (
      w.programId !== undefined &&
      w.programId !== null &&
      w.programId !== ""
    ) {
      const p = programs.get(w.programId);
      if (!p || programWeek(p, w.date) < 1 || programWeek(p, w.date) > p.weeks)
        return false;
    }
    ids.add(w.id);
    const eids = new Set();
    return w.exercises.every((e) => {
      if (
        !e ||
        !text(e.id, 100) ||
        eids.has(e.id) ||
        !text(e.name, 100) ||
        !e.name.trim() ||
        !text(e.group, 12) ||
        (e.note !== undefined && !text(e.note, 1000)) ||
        !["time", "reps"].includes(e.mode) ||
        !Number.isInteger(e.sets) ||
        e.sets < 1 ||
        e.sets > 30 ||
        !num(e.target, 10000) ||
        e.target < 1 ||
        !num(e.weight, s.unit === "lbs" ? 5000 : 2000) ||
        !Array.isArray(e.logs) ||
        e.logs.length !== e.sets
      )
        return false;
      eids.add(e.id);
      return e.logs.every(
        (l) =>
          l &&
          typeof l.done === "boolean" &&
          logNum(l.weight, s.unit === "lbs" ? 5000 : 2000) &&
          logNum(l.actual, 10000) &&
          (!l.done || (l.weight !== "" && l.actual !== "")),
      );
    });
  });
}
