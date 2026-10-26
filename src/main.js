import { programsView, programForm } from "./programs.js";
import { createCloud } from "./cloud.js";
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/manrope";
import "./style.css";
import {
  uid,
  weekStart,
  key,
  addDays,
  exercise,
  initialState,
  progress,
  programWeek,
  programEnd,
  programError,
  shiftDate,
  daysApart,
  copyProgramWeek,
} from "./model.js";
const upArrow =
  '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12"/></svg>';
let state;
let storageError = false;
try {
  state = JSON.parse(localStorage.getItem("buff-v1")) || initialState();
  if (state.version !== 1 || !Array.isArray(state.workouts)) throw Error();
} catch {
  state = initialState();
  storageError = true;
}
let week = weekStart(),
  selected = key(new Date()),
  tab = "planner",
  modal = null,
  active = null,
  selectedProgramId = null,
  selectedProgramWeek = 1;
const app = document.querySelector("#app");
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const fmt = (s, opts) =>
  new Date(s + "T12:00:00").toLocaleDateString("en-US", opts);
const dateLabel = (s) => fmt(s, { month: "short", day: "numeric" });
function save() {
  cloud.save();
}

function workout() {
  return (
    state.workouts.find((w) => w.id === active) ||
    state.workouts.find((w) => w.date === selected)
  );
}
function program() {
  return (state.programs || []).find((p) => p.id === selectedProgramId);
}
function programSummary(w) {
  const p = (state.programs || []).find((p) => p.id === w.programId);
  return p ? `${p.name} · Week ${programWeek(p, w.date)}` : "";
}
function plannedDate(w) {
  return modal.type === "edit"
    ? w.date
    : tab === "programs" && program()
      ? shiftDate(program().startDate, (selectedProgramWeek - 1) * 7)
      : selected;
}
function workoutProgramFields(w, date) {
  const id =
    modal.type === "edit"
      ? w.programId
      : tab === "programs"
        ? selectedProgramId
        : "";
  const p = (state.programs || []).find((p) => p.id === id);
  return `<label>Program <span class="optional">optional</span><select name="programId"><option value="">No program</option>${(state.programs || []).map((p) => `<option value="${esc(p.id)}" ${p.id === id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label><div id="workout-program-week">${programWeekField(p, date)}</div>`;
}
function programWeekField(p, date) {
  if (!p) return "";
  const n = Math.max(1, Math.min(p.weeks, programWeek(p, date) || 1));
  return `<label>Program week<select name="programWeek">${Array.from({ length: p.weeks }, (_, i) => `<option value="${i + 1}" ${i + 1 === n ? "selected" : ""}>Week ${i + 1}</option>`).join("")}</select><small>${dateLabel(p.startDate)} – ${dateLabel(programEnd(p))}</small></label>`;
}
function programDialog() {
  const p = program();
  const copy = modal.type === "copy-week";
  const edit = modal.type === "edit-program";
  return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-header"><div><div class="eyebrow">BUILD A LITTLE MOMENTUM</div><h2 id="modal-title">${copy ? `Copy Week ${selectedProgramWeek}` : edit ? "Edit program" : "Create a program"}</h2></div><button class="icon-button close" data-action="close" aria-label="Close dialog">×</button></div>${
    copy
      ? `<form id="copy-week-form"><p class="field-help">Copy the exercises, sets, targets and supersets to another week. New copies start with empty logs; existing workouts stay as they are.</p><label>Destination week<select name="targetWeek">${Array.from(
          { length: p.weeks },
          (_, i) => i + 1,
        )
          .filter((n) => n !== selectedProgramWeek)
          .map((n) => `<option value="${n}">Week ${n}</option>`)
          .join(
            "",
          )}</select></label><p class="form-error" role="alert"></p><div class="modal-footer"><span></span><button class="button primary" type="submit">Copy workouts →</button></div></form>`
      : programForm(edit ? p : null, weekStart(), esc)
  }</section></div>`;
}
function render() {
  state.programs ||= [];
  if (selectedProgramId && !program()) selectedProgramId = null;
  if (program())
    selectedProgramWeek = Math.max(
      1,
      Math.min(selectedProgramWeek, program().weeks),
    );
  const pageTitle =
    tab === "programs"
      ? program()
        ? program().name
        : "Your next chapter."
      : tab === "planner"
        ? "Your week, in motion."
        : "Look how far you’ve come.";
  const pageDescription =
    tab === "programs"
      ? program()
        ? `${program().weeks} weeks · ${dateLabel(program().startDate)} – ${dateLabel(programEnd(program()))}`
        : "Create a program. Build it week by week. Make it your own."
      : tab === "planner"
        ? "A little planning. A little consistency. A stronger you."
        : "Every set is a step forward. Here’s the work you’ve put in.";

  const weekly = state.workouts.filter(
    (w) => w.date >= week && w.date <= addDays(week, 6),
  );
  const completed = weekly.filter((w) => {
    let p = progress(w);
    return p.total && p.total === p.done;
  }).length;
  const total = weekly.reduce((n, w) => n + progress(w).total, 0);
  const done = weekly.reduce((n, w) => n + progress(w).done, 0);
  app.innerHTML = `<aside class="sidebar"><a class="brand" href="#" aria-label="Buff home"><span class="brand-icon">b.</span>buff<span class="brand-dot">.</span></a><div class="workspace-label">YOUR WORKSPACE</div><nav><button data-tab="programs" class="nav-item ${tab === "programs" ? "active" : ""}"><span>▤</span> Programs</button><button data-tab="planner" class="nav-item ${tab === "planner" ? "active" : ""}"><span>▦</span> Weekly planner</button><button data-tab="history" class="nav-item ${tab === "history" ? "active" : ""}"><span>◷</span> Workout history</button></nav><div class="sidebar-bottom"><div class="mini-mark">${upArrow}</div><strong>A little stronger, every week.</strong><p>Show up. Put in the work.<br>Make it yours.</p></div><div class="profile"><span class="avatar">Y</span><div><strong>Your workspace</strong><small>Personal training journal</small></div></div></aside>
<main><header class="topbar"><div><span class="breadcrumb">Workspace</span><span class="slash">/</span> ${tab === "programs" ? "Programs" : tab === "planner" ? "Weekly planner" : "Workout history"}</div><button class="local-badge" data-action="account" aria-label="Account and cross-device sync"><i></i><span id="sync-label">${esc(cloud.label())}</span> <span class="sync-link">Account</span></button></header><div class="content"><div class="page-heading"><div><div class="eyebrow">MAKE ROOM FOR PROGRESS</div><h1>${esc(pageTitle)}</h1><p>${esc(pageDescription)}</p></div><button class="button primary" data-action="${tab === "programs" && !program() ? "new-program" : "new-workout"}">+ <span>${tab === "programs" && !program() ? "Create program" : "Plan a workout"}</span></button></div>
${storageError ? '<div class="notice">Device storage is unavailable or was reset. Your changes may not persist after closing this page.</div>' : ""}
${
  tab === "planner"
    ? `<section class="stats"><div class="stat"><span class="stat-icon purple">▦</span><div><small>WORKOUTS PLANNED</small><strong>${weekly.length}<em>this week</em></strong></div></div><div class="stat"><span class="stat-icon green">✓</span><div><small>WORKOUTS COMPLETED</small><strong>${completed}<em>of ${weekly.length} planned</em></strong></div></div><div class="stat"><span class="stat-icon orange">ϟ</span><div><small>SETS IN THE BANK</small><strong>${done}<em>of ${total} planned</em></strong></div></div></section>
<section class="calendar"><div class="section-title"><h2>Weekly schedule</h2><div class="week-controls"><button data-action="prev" aria-label="Previous week">‹</button><strong>${dateLabel(week)} – ${dateLabel(addDays(week, 6))}, ${fmt(addDays(week, 6), { year: "numeric" })}</strong><button data-action="next" aria-label="Next week">›</button><button class="today" data-action="today">Today</button></div></div><div class="days">${Array.from(
        { length: 7 },
        (_, i) => {
          const date = addDays(week, i),
            ws = state.workouts.filter((w) => w.date === date);
          return `<button class="day ${date === selected ? "selected" : ""}" data-day="${date}"><span class="day-name">${fmt(date, { weekday: "short" })} ${date === key(new Date()) ? '<i class="today-dot"></i>' : ""}</span><strong>${fmt(date, { day: "numeric" })}</strong>${ws.length ? `<span class="day-workout">${esc(ws[0].name)}</span><small>${ws.length > 1 ? `${ws.length} workouts` : `${ws[0].exercises.length} exercises`}</small>` : '<span class="rest-label">Rest & recharge</span>'}</button>`;
        },
      ).join("")}</div></section>
<div class="detail-heading"><div><h2>${fmt(selected, { weekday: "long" })}<span>${fmt(selected, { month: "long", day: "numeric" })}</span></h2><p>Your plan. One good set at a time.</p></div><button class="text-button" data-action="new-workout">+ Add workout</button></div>${
        state.workouts
          .filter((w) => w.date === selected)
          .map(workoutCard)
          .join("") ||
        `<div class="empty"><span>☀</span><h3>A little space for your next win.</h3><p>Plan a workout for this day, or enjoy some well-earned rest.</p><button class="button primary" data-action="new-workout">+ Plan a workout</button></div>`
      }`
    : tab === "programs"
      ? programsView({
          state,
          selectedId: selectedProgramId,
          week: selectedProgramWeek,
          workoutCard,
          esc,
          dateLabel,
        })
      : history()
}
<footer><span class="footer-logo">b.</span> Progress isn’t always loud. Sometimes it’s just showing up. <span>YOU’VE GOT THIS</span></footer></div></main>${modal ? dialog() : ""}`;
  const strip = app.querySelector(".program-weeks"),
    chip = strip?.querySelector(".selected");
  if (chip)
    strip.scrollLeft =
      chip.offsetLeft - (strip.clientWidth - chip.clientWidth) / 2;
}
function workoutCard(w) {
  const p = progress(w);
  let lastGroup = null;
  return `<article class="workout-card"><div class="workout-heading"><div class="workout-symbol">${upArrow}</div><div class="workout-title"><div class="tag">${p.total && p.done === p.total ? "COMPLETED" : programSummary(w) ? esc(programSummary(w)) : "STRENGTH & CONDITIONING"}</div><h2>${esc(w.name)}</h2><p>${w.exercises.length} exercises <span>·</span> ${p.total} sets <span>·</span> ${p.done} sets completed</p></div><div class="workout-actions"><button class="button subtle" data-action="edit-workout" data-id="${w.id}">Edit plan</button><button class="button primary" data-action="log" data-id="${w.id}">${p.done ? "Continue logging" : "Log workout"} <span>→</span></button></div></div>${w.note ? `<p class="workout-note">${esc(w.note)}</p>` : ""}<div class="exercise-table"><div class="exercise-table-head"><span>EXERCISE</span><span>SETS</span><span>TARGET</span><span>WEIGHT</span><span></span></div>${w.exercises
    .map((e, i) => {
      const newGroup = e.group && e.group !== lastGroup;
      lastGroup = e.group;
      return `${newGroup ? `<div class="superset-label"><span>⇄</span> SUPERSET ${esc(e.group)} <small>Alternate these exercises</small></div>` : ""}<div class="exercise-row ${e.group ? "grouped" : ""}"><div class="exercise-name"><span class="exercise-number">${String(i + 1).padStart(2, "0")}</span><div><strong>${esc(e.name)}</strong><small>${e.mode === "time" ? "Time-based" : "Rep-based"}${e.group ? ` · Superset ${esc(e.group)}` : ""}</small></div></div><span class="sets-pill">${e.sets} sets</span><span>${e.target} ${e.mode === "time" ? "sec" : "reps"}</span><span>${e.weight ? `${e.weight} ${state.unit}` : "Bodyweight"}</span><button class="icon-button" aria-label="Edit ${esc(e.name)}" data-action="edit-exercise" data-id="${w.id}" data-eid="${e.id}">•••</button></div>`;
    })
    .join(
      "",
    )}</div><div class="workout-bottom"><button class="text-button" data-action="add-exercise" data-id="${w.id}">+ Add exercise</button><span><i class="small-dot"></i> ${p.done}/${p.total} sets logged</span></div></article>`;
}
function history() {
  const ws = state.workouts
    .filter((w) => progress(w).done > 0)
    .sort((a, b) => b.date.localeCompare(a.date));
  return `<section class="history-list">${ws.map((w) => `<article class="history-card"><div><span class="tag">${dateLabel(w.date)} · ${fmt(w.date, { year: "numeric" })}${programSummary(w) ? ` · ${esc(programSummary(w))}` : ""}</span><h2>${esc(w.name)}</h2><p>${progress(w).done} of ${progress(w).total} sets logged</p></div><button class="button primary" data-action="log" data-id="${w.id}">View log →</button></article>`).join("") || '<div class="empty"><span>↑</span><h3>Your story starts with a set.</h3><p>Log your first workout to see it here.</p></div>'}</section>`;
}
function dialog() {
  if (["new-program", "edit-program", "copy-week"].includes(modal.type))
    return programDialog();
  const w = workout(),
    e = w?.exercises.find((e) => e.id === modal.eid);
  const workoutDate = plannedDate(w);
  const assignedProgram = (state.programs || []).find(
    (p) =>
      p.id ===
      (modal.type === "edit"
        ? w?.programId
        : tab === "programs"
          ? selectedProgramId
          : null),
  );
  return `<div class="modal-backdrop"><section class="modal ${modal.type === "log" ? "log-modal" : ""}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-header"><div><div class="eyebrow">YOUR TRAINING JOURNAL</div><h2 id="modal-title">${modal.type === "log" ? esc(w.name) : modal.type === "exercise" ? (e ? "Edit exercise" : "Add an exercise") : modal.type === "edit" ? "Edit workout" : "Plan a workout"}</h2></div><button class="icon-button close" data-action="close" aria-label="Close dialog">×</button></div>${modal.type === "log" ? logForm(w) : modal.type === "exercise" ? `<form id="exercise-form"><label>Exercise name<input name="name" required maxlength="100" placeholder="e.g. Dumbbell bench press" value="${esc(e?.name || "")}"></label><div class="form-grid"><label>Sets<input name="sets" type="number" required min="1" max="30" value="${e?.sets || 3}"></label><label>Track by<select name="mode"><option value="reps" ${e?.mode !== "time" ? "selected" : ""}>Repetitions</option><option value="time" ${e?.mode === "time" ? "selected" : ""}>Time (seconds)</option></select></label><label>Target per set<input name="target" type="number" required min="1" max="10000" value="${e?.target || 10}"></label><label>Planned weight (${state.unit})<input name="weight" type="number" min="0" max="2000" step="0.25" value="${e?.weight || 0}"></label></div><label>Superset group <span class="optional">optional</span><input name="group" maxlength="12" placeholder="e.g. A" value="${esc(e?.group || "")}"><small>Use the same group for exercises you want to alternate.</small></label><div class="modal-footer">${e ? '<button type="button" class="text-button danger" data-action="delete-exercise">Remove exercise</button>' : "<span></span>"}<button class="button primary" type="submit">${e ? "Save changes" : "Add exercise"} →</button></div></form>` : `<form id="workout-form"><label>Workout name<input name="name" required maxlength="100" placeholder="e.g. Lower body strength" value="${esc(modal.type === "edit" ? w.name : "")}"></label>${workoutProgramFields(w, workoutDate)}<label>Date<input name="date" type="date" required value="${workoutDate}" ${assignedProgram ? `min="${assignedProgram.startDate}" max="${programEnd(assignedProgram)}"` : ""}></label><label>Workout notes <span class="optional">optional</span><textarea name="note" maxlength="500" placeholder="A focus, a reminder, a little motivation…">${esc(modal.type === "edit" ? w.note : "")}</textarea></label><div class="modal-footer">${modal.type === "edit" ? '<button type="button" class="text-button danger" data-action="delete-workout">Delete workout</button>' : "<span></span>"}<button class="button primary" type="submit">${modal.type === "edit" ? "Save changes" : "Create workout"} →</button></div></form>`}</section></div>`;
}
function logForm(w) {
  return `<p class="log-intro">Enter weight (0 for bodyweight) and reps or seconds, then tick each completed set.</p><form id="log-form">${w.exercises.map((e) => `<div class="log-exercise"><h3>${esc(e.name)} ${e.group ? `<span class="superset-chip">Superset ${esc(e.group)}</span>` : ""}</h3><p>Target: ${e.sets} × ${e.target} ${e.mode === "time" ? "sec" : "reps"}${e.weight ? ` at ${e.weight} ${state.unit}` : ""}</p><div class="log-head"><span>SET</span><span>WEIGHT (${state.unit})</span><span>${e.mode === "time" ? "TIME (SEC)" : "REPS"}</span><span>DONE</span></div>${e.logs.map((l, i) => `<div class="log-row ${l.done ? "set-done" : ""}"><strong>${i + 1}</strong><input aria-label="${esc(e.name)} set ${i + 1} weight" type="number" min="0" max="2000" step="0.25" placeholder="${e.weight}" value="${esc(l.weight)}" data-eid="${e.id}" data-set="${i}" data-field="weight"><input aria-label="${esc(e.name)} set ${i + 1} ${e.mode === "time" ? "seconds" : "reps"}" type="number" min="0" max="10000" step="1" placeholder="${e.target}" value="${esc(l.actual)}" data-eid="${e.id}" data-set="${i}" data-field="actual"><input aria-label="${esc(e.name)} set ${i + 1} completed" type="checkbox" ${l.done ? "checked" : ""} data-eid="${e.id}" data-set="${i}" data-field="done"></div>`).join("")}</div>`).join("") || "<p>Add an exercise to your plan to start logging.</p>"}<div class="modal-footer"><span class="autosave">Changes save automatically</span><button type="button" class="button primary" data-action="close">Done logging ✓</button></div></form>`;
}
app.addEventListener("click", (event) => {
  const b = event.target.closest("button");
  if (!b) return;
  if (b.dataset.tab) {
    tab = b.dataset.tab;
    render();
    return;
  }
  if (b.dataset.day) {
    selected = b.dataset.day;
    render();
    return;
  }
  const a = b.dataset.action;
  if (!a) return;
  if (a === "new-program") modal = { type: "new-program" };
  if (a === "open-program") {
    selectedProgramId = b.dataset.program;
    selectedProgramWeek = 1;
    tab = "programs";
  }
  if (a === "all-programs") {
    selectedProgramId = null;
    selectedProgramWeek = 1;
  }
  if (a === "program-week") selectedProgramWeek = Number(b.dataset.week);
  if (a === "edit-program") modal = { type: "edit-program" };
  if (a === "copy-week") modal = { type: "copy-week" };
  if (
    a === "delete-program" &&
    confirm(
      "Delete this program? All workouts and logged sets will be kept in your weekly planner.",
    )
  ) {
    for (const w of state.workouts)
      if (w.programId === selectedProgramId) delete w.programId;
    state.programs = state.programs.filter((p) => p.id !== selectedProgramId);
    selectedProgramId = null;
    modal = null;
    save();
  }
  if (a === "account") {
    cloud.open();
    return;
  }
  if (b.dataset.id) active = b.dataset.id;
  if (a === "prev" || a === "next") {
    week = addDays(week, a === "prev" ? -7 : 7);
    selected = week;
  }
  if (a === "today") {
    week = weekStart();
    selected = key(new Date());
  }
  if (a === "new-workout") {
    active = null;
    modal = { type: "new" };
  }
  if (a === "edit-workout") modal = { type: "edit" };
  if (a === "log") modal = { type: "log" };
  if (a === "add-exercise") modal = { type: "exercise" };
  if (a === "edit-exercise") modal = { type: "exercise", eid: b.dataset.eid };
  if (a === "close") modal = null;
  if (
    a === "delete-workout" &&
    confirm("Delete this workout and its logged sets?")
  ) {
    state.workouts = state.workouts.filter((w) => w.id !== active);
    modal = null;
    save();
  }
  if (
    a === "delete-exercise" &&
    confirm("Remove this exercise and its logged sets?")
  ) {
    workout().exercises = workout().exercises.filter((e) => e.id !== modal.eid);
    modal = null;
    save();
  }
  render();
  if (modal) app.querySelector(".modal input, .modal button")?.focus();
});
app.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.target;
  if (!form.reportValidity()) return;
  const data = Object.fromEntries(new FormData(form));
  if (form.id === "program-form") {
    if (modal.type !== "edit-program" && state.programs.length >= 500) {
      form.querySelector(".form-error").textContent =
        "Your journal can hold up to 500 programs.";
      return;
    }
    const p = {
      id: modal.type === "edit-program" ? selectedProgramId : uid(),
      name: data.name.trim(),
      weeks: Number(data.weeks),
      startDate: data.startDate,
      note: data.note.trim(),
    };
    const error = programError(p, state.workouts);
    if (error) {
      form.querySelector(".form-error").textContent = error;
      return;
    }
    if (modal.type === "edit-program")
      state.programs[state.programs.findIndex((x) => x.id === p.id)] = p;
    else state.programs.push(p);
    selectedProgramId = p.id;
    selectedProgramWeek = Math.min(selectedProgramWeek, p.weeks);
    tab = "programs";
    modal = null;
  }
  if (form.id === "copy-week-form") {
    try {
      copyProgramWeek(
        state,
        selectedProgramId,
        selectedProgramWeek,
        Number(data.targetWeek),
      );
      selectedProgramWeek = Number(data.targetWeek);
      modal = null;
    } catch (e) {
      form.querySelector(".form-error").textContent = e.message;
      return;
    }
  }
  if (form.id === "workout-form") {
    if (!data.name.trim()) return;
    let w;
    if (modal.type === "edit") {
      w = workout();
      Object.assign(w, {
        name: data.name.trim(),
        date: data.date,
        note: data.note.trim(),
      });
    } else {
      w = {
        id: uid(),
        name: data.name.trim(),
        date: data.date,
        note: data.note.trim(),
        exercises: [],
      };
      state.workouts.push(w);
    }
    if (data.programId) w.programId = data.programId;
    else delete w.programId;
    if (tab === "programs" && w.programId) {
      selectedProgramId = w.programId;
      selectedProgramWeek = programWeek(program(), w.date);
    }
    selected = w.date;
    week = weekStart(new Date(w.date + "T12:00:00"));
    active = w.id;
    modal = null;
  }
  if (form.id === "exercise-form") {
    if (!data.name.trim()) return;
    const w = workout(),
      old = w.exercises.find((e) => e.id === modal.eid);
    const e = exercise(
      data.name.trim(),
      Number(data.sets),
      Number(data.target),
      data.mode,
      Number(data.weight),
      data.group.trim().toUpperCase(),
    );
    if (old) {
      e.id = old.id;
      e.logs = e.logs.map((l, i) =>
        old.mode === e.mode ? old.logs[i] || l : l,
      );
      w.exercises[w.exercises.indexOf(old)] = e;
    } else w.exercises.push(e);
    const order = new Map();
    w.exercises.forEach((e) => {
      const k = e.group || e.id;
      if (!order.has(k)) order.set(k, order.size);
    });
    w.exercises.sort(
      (a, b) => order.get(a.group || a.id) - order.get(b.group || b.id),
    );
    modal = null;
  }
  save();
  render();
});
app.addEventListener("change", (event) => {
  const input = event.target;
  if (input.id === "program-week-picker") {
    selectedProgramWeek = Number(input.value);
    render();
    return;
  }
  if (input.name === "programId") {
    const form = input.form,
      p = (state.programs || []).find((p) => p.id === input.value),
      date = form.elements.date;
    if (p) {
      if (
        !date.value ||
        programWeek(p, date.value) < 1 ||
        programWeek(p, date.value) > p.weeks
      )
        date.value = p.startDate;
      date.min = p.startDate;
      date.max = programEnd(p);
    } else {
      date.removeAttribute("min");
      date.removeAttribute("max");
    }
    form.querySelector("#workout-program-week").innerHTML = programWeekField(
      p,
      date.value,
    );
    return;
  }
  if (input.name === "programWeek") {
    const form = input.form,
      p = state.programs.find((p) => p.id === form.elements.programId.value),
      date = form.elements.date;
    const delta = daysApart(p.startDate, date.value);
    const offset = Number.isFinite(delta) ? ((delta % 7) + 7) % 7 : 0;
    date.value = shiftDate(p.startDate, (Number(input.value) - 1) * 7 + offset);
    return;
  }
  if (input.name === "date" && input.form?.id === "workout-form") {
    const form = input.form,
      p = state.programs.find((p) => p.id === form.elements.programId.value);
    if (p && input.value)
      form.elements.programWeek.value = String(programWeek(p, input.value));
    return;
  }
  if (!input.dataset.field) return;
  if (!input.checkValidity()) {
    input.reportValidity();
    return;
  }
  const e = workout().exercises.find((e) => e.id === input.dataset.eid),
    log = e.logs[Number(input.dataset.set)];
  if (input.dataset.field === "done") {
    if (input.checked && (log.actual === "" || log.weight === "")) {
      input.checked = false;
      app.querySelector(".log-intro").textContent =
        "Enter both weight (0 for bodyweight) and reps or seconds before completing a set.";
      input
        .closest(".log-row")
        .querySelector(
          log.weight === "" ? '[data-field="weight"]' : '[data-field="actual"]',
        )
        .focus();
      return;
    }
    log.done = input.checked;
    input.closest(".log-row").classList.toggle("set-done", input.checked);
  } else {
    log[input.dataset.field] = input.value;
    if (input.value === "") {
      log.done = false;
      input.closest(".log-row").classList.remove("set-done");
      input.closest(".log-row").querySelector('[type="checkbox"]').checked =
        false;
    }
  }
  save();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modal) {
    modal = null;
    render();
  }
  if (e.key === "Tab" && modal) {
    const els = [
      ...app.querySelectorAll(
        ".modal button,.modal input,.modal select,.modal textarea",
      ),
    ];
    const first = els[0],
      last = els.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
});
const cloud = createCloud({
  getState: () => state,
  setState: (next) => {
    state = next;
    modal = null;
    active = null;
    render();
  },
  canApply: () => !modal,
  onStatus: (label) => {
    const el = document.querySelector("#sync-label");
    if (el) el.textContent = label;
  },
});
render();
cloud.start();
