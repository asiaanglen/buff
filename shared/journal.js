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
    s.unit !== "kg" ||
    !Array.isArray(s.workouts) ||
    s.workouts.length > 5000
  )
    return false;
  const ids = new Set();
  return s.workouts.every((w) => {
    if (
      !w ||
      !text(w.id, 100) ||
      ids.has(w.id) ||
      !text(w.name, 100) ||
      !w.name.trim() ||
      !text(w.note, 500) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(w.date) ||
      !Array.isArray(w.exercises) ||
      w.exercises.length > 200
    )
      return false;
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
        !["time", "reps"].includes(e.mode) ||
        !Number.isInteger(e.sets) ||
        e.sets < 1 ||
        e.sets > 30 ||
        !num(e.target, 10000) ||
        e.target < 1 ||
        !num(e.weight, 2000) ||
        !Array.isArray(e.logs) ||
        e.logs.length !== e.sets
      )
        return false;
      eids.add(e.id);
      return e.logs.every(
        (l) =>
          l &&
          typeof l.done === "boolean" &&
          logNum(l.weight, 2000) &&
          logNum(l.actual, 10000) &&
          (!l.done || (l.weight !== "" && l.actual !== "")),
      );
    });
  });
}
