import { exerciseByName } from "../shared/exercises.js";
import { connectAiView, copyAiEndpoint } from "./connect-ai.js";
import { supersetDialog, saveSuperset, sortSupersets } from "./supersets.js";
import {
  exerciseLibrary,
  renderExerciseResults,
  findLibraryExercise,
  exerciseGuideButton,
  showExerciseGuide,
} from "./exercise-library.js";
import { homeView, isWorkoutComplete } from "./home.js";
import { setupPwa } from "./pwa.js";
import { landingPage } from "./landing.js";
import { createProgramImporter } from "./import-ui.js";
import { programsView, programForm } from "./programs.js";
import { createCloud } from "./cloud.js";
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/manrope";
import "./style.css";
import "./workout-log.css";
import {
  uid,
  weekStart,
  key,
  addDays,
  exercise,
  initialState,
  progress,
  previousExercisePerformance,
  exercisePerformanceHistory,
  inPounds,
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
if (state.unit === "kg") {
  state = inPounds(state);
  try {
    localStorage.setItem("buff-v1", JSON.stringify(state));
  } catch {
    storageError = true;
  }
}
let week = weekStart(),
  selected = key(new Date()),
  tab = "planner",
  modal = null,
  active = null,
  selectedProgramId = null,
  selectedProgramWeek = 1;
const app = document.querySelector("#app");
const loggingWorkouts = new Set();
const openExerciseIds = new Map();
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
let initializing = true;
let startupError = false;
let lastRenderSignedIn = false;
function render() {
  if (initializing || startupError) {
    document.title = "Buff — Your workouts";
    app.innerHTML = `<section class="boot-screen" ${initializing ? 'role="status" aria-live="polite"' : ""}><div class="boot-content"><span class="boot-mark" aria-hidden="true">b.</span>${initializing ? '<span class="boot-spinner" aria-hidden="true"></span><h1>Loading Buff</h1><p>Getting your workouts ready…</p>' : '<h1>Couldn’t load Buff</h1><p>Check your connection, then try again.</p><button class="button primary" data-action="retry-start">Try again</button>'}</div></section>`;
    return;
  }
  const signedIn = cloud.isSignedIn();
  if (signedIn !== lastRenderSignedIn) {
    window.scrollTo(0, 0);
    tab = signedIn && state.activeProgramId ? "home" : "planner";
  }
  lastRenderSignedIn = signedIn;
  if (!cloud.isSignedIn()) {
    document.title = "Buff — Your next chapter starts with a plan.";
    app.innerHTML = landingPage();
    return;
  }
  document.title = "Buff — Your week. Your progress.";

  state.programs ||= [];
  if (selectedProgramId && !program()) selectedProgramId = null;
  if (program())
    selectedProgramWeek = Math.max(
      1,
      Math.min(selectedProgramWeek, program().weeks),
    );
  const pageTitle =
    tab === "ai"
      ? "Connect to AI"
      : tab === "home"
        ? "Your next good workout."
        : tab === "programs"
          ? program()
            ? program().name
            : "Your next chapter."
          : tab === "planner"
            ? "Your week, in motion."
            : "Completed workouts";
  const pageDescription =
    tab === "ai"
      ? "Bring your workouts into Claude or ChatGPT, with you in control."
      : tab === "home"
        ? "Your program. One workout at a time."
        : tab === "programs"
          ? program()
            ? `${program().weeks} weeks · ${dateLabel(program().startDate)} – ${dateLabel(programEnd(program()))}`
            : "Create a program. Build it week by week. Make it your own."
          : tab === "planner"
            ? "A little planning. A little consistency. A stronger you."
            : "The workouts you’ve finished, with every logged set saved.";

  const weekly = state.workouts.filter(
    (w) => w.date >= week && w.date <= addDays(week, 6),
  );
  const completed = weekly.filter((w) => {
    let p = progress(w);
    return p.total && p.total === p.done;
  }).length;
  const total = weekly.reduce((n, w) => n + progress(w).total, 0);
  const done = weekly.reduce((n, w) => n + progress(w).done, 0);
  app.innerHTML = `<aside class="sidebar"><a class="brand" href="/" aria-label="Buff home"><span class="brand-icon">b.</span>buff<span class="brand-dot">.</span></a><div class="workspace-label">YOUR WORKSPACE</div><nav><button data-tab="home" class="nav-item ${tab === "home" ? "active" : ""}"><span>⌂</span> Home</button><button data-tab="programs" class="nav-item ${tab === "programs" ? "active" : ""}"><span>▤</span> Programs</button><button data-tab="planner" class="nav-item ${tab === "planner" ? "active" : ""}"><span>▦</span> Weekly planner</button><button data-tab="history" class="nav-item ${tab === "history" ? "active" : ""}"><span>◷</span> Completed workouts</button><button data-tab="ai" class="nav-item ${tab === "ai" ? "active" : ""}"><span>✧</span> Connect to AI</button></nav><div class="mobile-navigation"><label for="mobile-page-select">Go to</label><select id="mobile-page-select" aria-label="Go to page">${[
    ["home", "Home"],
    ["programs", "Programs"],
    ["planner", "Weekly planner"],
    ["history", "Completed workouts"],
    ["ai", "Connect to AI"],
  ]
    .map(
      ([value, label]) =>
        `<option value="${value}" ${tab === value ? "selected" : ""}>${label}</option>`,
    )
    .join(
      "",
    )}</select></div><div class="sidebar-bottom"><div class="mini-mark">${upArrow}</div><strong>A little stronger, every week.</strong><p>Show up. Put in the work.<br>Make it yours.</p></div><div class="profile"><span class="avatar">Y</span><div><strong>Your workspace</strong><small>Personal training journal</small></div></div></aside>
<main><header class="topbar"><div><span class="breadcrumb">Workspace</span><span class="slash">/</span> ${tab === "ai" ? "Connect to AI" : tab === "home" ? "Home" : tab === "programs" ? "Programs" : tab === "planner" ? "Weekly planner" : "Completed workouts"}</div><button class="local-badge" data-action="account" aria-label="Account and cross-device sync"><i></i><span id="sync-label">${esc(cloud.label())}</span> <span class="sync-link">Account</span></button></header><div class="content"><div class="page-heading"><div><div class="eyebrow">MAKE ROOM FOR PROGRESS</div><h1>${esc(pageTitle)}</h1><p>${esc(pageDescription)}</p></div>${tab === "ai" ? "" : `<div class="heading-actions">${tab === "programs" ? '<button class="button subtle" data-action="import-program">↑ Import program</button>' : ""}<button class="button primary" data-action="${tab === "programs" && !program() ? "new-program" : "new-workout"}">+ <span>${tab === "programs" && !program() ? "Create program" : "Plan a workout"}</span></button></div>`}</div>
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
      : tab === "home"
        ? homeView({
            state,
            workoutCard,
            esc,
            dateLabel,
            workoutLog: (w) => (loggingWorkouts.has(w.id) ? logForm(w) : ""),
            isLogging: (id) => loggingWorkouts.has(id),
          })
        : tab === "ai"
          ? connectAiView(esc)
          : history()
}
<footer><span class="footer-logo">b.</span> Progress isn’t always loud. Sometimes it’s just showing up. <span>YOU’VE GOT THIS</span></footer></div></main>${modal ? dialog() : ""}`;
  renderExerciseResults(app, state, esc);
  if (window.matchMedia("(max-width: 600px)").matches) {
    const days = app.querySelector(".days");
    const day = days?.querySelector(".selected");
    if (day)
      days.scrollLeft =
        day.offsetLeft -
        days.offsetLeft -
        (days.clientWidth - day.clientWidth) / 2;
  }
  const strip = app.querySelector(".program-weeks"),
    chip = strip?.querySelector(".selected");
  if (chip)
    strip.scrollLeft =
      chip.offsetLeft - (strip.clientWidth - chip.clientWidth) / 2;
}
function selectedExerciseCard(w, e) {
  const entry =
    (e.libraryId && findLibraryExercise(e.libraryId)) || exerciseByName(e.name);
  return `<div class="selected-exercise-card"><div><span class="eyebrow">${entry ? "EXERCISE LIBRARY" : "CUSTOM EXERCISE"}</span><h3>${esc(entry?.name || e.name)}</h3>${entry ? `<p>${esc(entry.category)} · ${esc(entry.equipment)}</p>` : ""}</div><div class="selected-exercise-actions">${exerciseGuideButton(entry?.name || e.name, esc)}${swapButton(w, e)}</div></div>`;
}
function swapButton(w, e) {
  const recorded = e.logs.some(
    (log) => log.done || log.weight !== "" || log.actual !== "",
  );
  return `<button type="button" class="text-button swap-exercise" data-action="swap-exercise" data-id="${w.id}" data-eid="${e.id}" aria-label="Swap exercise: ${esc(e.name)}" ${recorded ? 'disabled title="This exercise has recorded results; add a replacement to preserve its history."' : ""}>Swap exercise</button>`;
}
function workoutCard(w) {
  const p = progress(w);
  const logging = loggingWorkouts.has(w.id);
  let lastGroup = null;
  return `<article class="workout-card ${isWorkoutComplete(w) ? "workout-complete" : ""}"><div class="workout-heading"><div class="workout-symbol">${upArrow}</div><div class="workout-title"><div class="tag">${p.total && p.done === p.total ? "COMPLETED" : programSummary(w) ? esc(programSummary(w)) : "STRENGTH & CONDITIONING"}</div><h2>${esc(w.name)}</h2><p>${w.exercises.length} exercises <span>·</span> ${p.total} sets <span>·</span> ${p.done} sets completed</p></div><div class="workout-actions"><button class="button subtle" data-action="edit-workout" data-id="${w.id}">Edit plan</button><button class="button primary" data-action="log" data-id="${w.id}">${logging ? "Collapse workout" : p.done ? "Resume workout" : "Start workout"} <span>→</span></button></div></div>${w.note ? `<p class="workout-note">${esc(w.note)}</p>` : ""}${
    logging
      ? logForm(w)
      : `<p class="exercise-log-hint">Tap <strong>Log sets</strong> on an exercise to record your weight, reps or time.</p><div class="exercise-table"><div class="exercise-table-head"><span>EXERCISE</span><span>SETS</span><span>TARGET</span><span>WEIGHT</span><span></span></div>${w.exercises
          .map((e, i) => {
            const newGroup = e.group && e.group !== lastGroup;
            lastGroup = e.group;
            return `${newGroup ? `<div class="superset-label"><span>⇄</span> SUPERSET ${esc(e.group)} <small>Alternate these exercises</small></div>` : ""}<div class="exercise-row ${e.group ? "grouped" : ""}"><div class="exercise-name"><span class="exercise-number">${String(i + 1).padStart(2, "0")}</span><div><div class="exercise-title-actions"><button type="button" class="exercise-toggle" data-action="expand-exercise" data-id="${w.id}" data-eid="${e.id}" aria-expanded="false"><strong>${esc(e.name)}</strong><span class="exercise-log-cta">Log sets <span aria-hidden="true">⌄</span></span></button>${swapButton(w, e)}</div><small>${e.mode === "time" ? "Time-based" : "Rep-based"}${e.group ? ` · Superset ${esc(e.group)}` : ""}</small>${exerciseGuideButton(e.name, esc)}</div></div><span class="sets-pill">${e.sets} sets</span><span>${e.target} ${e.mode === "time" ? "sec" : "reps"}</span><span>${e.weight ? `${e.weight} ${state.unit}` : "Bodyweight"}</span><button class="icon-button" aria-label="Edit ${esc(e.name)}" data-action="edit-exercise" data-id="${w.id}" data-eid="${e.id}">•••</button></div>`;
          })
          .join("")}</div>`
  }<div class="workout-bottom"><button class="text-button" data-action="add-exercise" data-id="${w.id}">+ Add exercise</button><button class="text-button" data-action="supersets" data-id="${w.id}">⇄ Supersets</button><span><i class="small-dot"></i> ${p.done}/${p.total} sets logged</span></div></article>`;
}
function history() {
  const ws = state.workouts
    .filter((w) => isWorkoutComplete(w) || loggingWorkouts.has(w.id))
    .sort((a, b) => b.date.localeCompare(a.date));
  return `<section class="history-list">${ws.map((w) => `<article class="history-card"><div><span class="tag">${dateLabel(w.date)} · ${fmt(w.date, { year: "numeric" })}${programSummary(w) ? ` · ${esc(programSummary(w))}` : ""}</span><h2>${esc(w.name)}</h2><p>${progress(w).done} of ${progress(w).total} sets logged</p></div><button class="button primary" data-action="log" data-id="${w.id}">${loggingWorkouts.has(w.id) ? "Collapse workout" : "View log →"}</button>${loggingWorkouts.has(w.id) ? logForm(w) : ""}</article>`).join("") || '<div class="empty"><span>↑</span><h3>Your next finish starts with a set.</h3><p>Complete a workout to see it here.</p></div>'}</section>`;
}
function dialog() {
  if (modal.type === "supersets")
    return supersetDialog(workout(), modal.group || "", esc);
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
  return `<div class="modal-backdrop"><section class="modal ${modal.type === "log" ? "log-modal" : ""}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-header"><div><div class="eyebrow">YOUR TRAINING JOURNAL</div><h2 id="modal-title">${modal.type === "log" ? esc(w.name) : modal.type === "swap" ? "Swap exercise" : modal.type === "exercise" ? (e ? "Edit exercise" : "Add an exercise") : modal.type === "edit" ? "Edit workout" : "Plan a workout"}</h2></div><button class="icon-button close" data-action="close" aria-label="Close dialog">×</button></div>${modal.type === "log" ? logForm(w) : ["exercise", "swap"].includes(modal.type) ? `<form id="exercise-form">${modal.type === "swap" ? '<p class="exercise-swap-message" role="status">Choose a replacement from the library or enter a custom exercise. Sets, targets and superset membership are kept; adjust them if needed.</p>' : ""}<label>Exercise name<input name="name" required maxlength="100" placeholder="Search exercises or enter your own" autocomplete="off" value="${esc(e?.name || "")}"></label>${modal.type === "swap" || !e ? exerciseLibrary(esc) : selectedExerciseCard(w, e)}<div class="form-grid"><label>Sets<input name="sets" type="number" required min="1" max="30" value="${e?.sets || 3}"></label><label>Track by<select name="mode"><option value="reps" ${e?.mode !== "time" ? "selected" : ""}>Repetitions</option><option value="time" ${e?.mode === "time" ? "selected" : ""}>Time (seconds)</option></select></label><label>Target per set<input name="target" type="number" required min="1" max="10000" value="${e?.target || 10}"></label><label>Planned weight (${state.unit})<input name="weight" type="number" min="0" max="5000" step="0.01" value="${e?.weight || 0}"></label></div><label>Superset group <span class="optional">optional</span><input name="group" maxlength="12" placeholder="e.g. A" value="${esc(e?.group || "")}"><small>Use the same group for exercises you want to alternate.</small></label><div class="modal-footer">${e ? '<button type="button" class="text-button danger" data-action="delete-exercise">Remove exercise</button>' : "<span></span>"}<button class="button primary" type="submit">${modal.type === "swap" ? "Swap exercise" : e ? "Save changes" : "Add exercise"} →</button></div></form>` : `<form id="workout-form"><label>Workout name<input name="name" required maxlength="100" placeholder="e.g. Lower body strength" value="${esc(modal.type === "edit" ? w.name : "")}"></label>${workoutProgramFields(w, workoutDate)}<label>Date<input name="date" type="date" required value="${workoutDate}" ${assignedProgram ? `min="${assignedProgram.startDate}" max="${programEnd(assignedProgram)}"` : ""}></label><label>Workout notes <span class="optional">optional</span><textarea name="note" maxlength="500" placeholder="A focus, a reminder, a little motivation…">${esc(modal.type === "edit" ? w.note : "")}</textarea></label><div class="modal-footer">${modal.type === "edit" ? '<button type="button" class="text-button danger" data-action="delete-workout">Delete workout</button>' : "<span></span>"}<button class="button primary" type="submit">${modal.type === "edit" ? "Save changes" : "Create workout"} →</button></div></form>`}</section></div>`;
}
function previousPerformanceHeader(w, e) {
  const history = previousExercisePerformance(state, w, e);
  if (!history)
    return '<p class="previous-performance empty-history">No completed history for this exercise yet.</p>';
  return `<div class="previous-performance"><span>LAST TIME · ${esc(fmt(history.date, { month: "short", day: "numeric", year: "numeric" }))}</span><strong>${history.latest.weight} ${state.unit} × ${history.latest.actual} ${e.mode === "time" ? "sec" : "reps"}</strong><small>Last completed set (set ${history.latest.setNumber}) · ${esc(history.workoutName)}</small></div>`;
}
function workoutHistory(w) {
  return `<details class="workout-history"><summary>Workout history</summary><p>Previous completed sets for these exercises, across your programs. Weight is in lbs.</p>${w.exercises
    .map((e) => {
      const sessions = exercisePerformanceHistory(state, w, e).slice(0, 30);
      return `<section class="exercise-history"><h3>${esc(e.name)}</h3>${sessions.map((session) => `<article><strong>${esc(session.workoutName)} · ${dateLabel(session.date)} ${esc(fmt(session.date, { year: "numeric" }))}</strong><ul>${session.sets.map((set) => `<li>Set ${set.setNumber}: ${set.weight} lbs × ${set.actual} ${e.mode === "time" ? "sec" : "reps"}</li>`).join("")}</ul>${session.note ? `<p class="exercise-history-note"><strong>Notes:</strong> ${esc(session.note)}</p>` : ""}</article>`).join("") || "<p>No previous completed sets yet.</p>"}</section>`;
    })
    .join("")}</details>`;
}
function previousSetCell(e, index, history) {
  const set = history?.sets.find((set) => set.setNumber === index + 1);
  return `<span class="log-previous" ${set ? `aria-label="Previous set ${index + 1}: ${set.weight} lbs × ${set.actual} ${e.mode === "time" ? "sec" : "reps"}"` : 'aria-label="No previous completed set"'}>${set ? `${set.weight} lbs <span>× ${set.actual}${e.mode === "time" ? " sec" : ""}</span>` : "—"}</span>`;
}
function exerciseLog(w, e, index) {
  const history = previousExercisePerformance(state, w, e);
  const entry =
    exerciseByName(e.name) || (e.libraryId && findLibraryExercise(e.libraryId));
  const groupHeading =
    e.group && (index === 0 || w.exercises[index - 1].group !== e.group)
      ? `<div class="log-superset-heading"><strong>Superset ${esc(e.group)}</strong><p>Alternate these exercises, one set each, then repeat for your remaining sets.</p></div>`
      : "";
  return `${groupHeading}<details class="log-exercise exercise-accordion" name="workout-${esc(w.id)}" data-exercise-id="${esc(e.id)}" ${(openExerciseIds.get(w.id) || new Set()).has(e.id) ? "open" : ""}>
    <summary>
      <span class="exercise-target-display">${e.target} <span>${e.mode === "time" ? "sec" : "reps"}</span></span>
      <h3>${esc(e.name)} ${e.group ? `<span class="superset-chip">Superset ${esc(e.group)}</span>` : ""}</h3>
      ${swapButton(w, e)}
      <span class="exercise-expand-label"><span class="exercise-open-label">Log sets</span><span class="exercise-close-label">Hide sets</span> · <span class="exercise-set-progress">${e.logs.filter((log) => log.done).length}/${e.sets} sets logged</span></span>
    </summary>
    <div class="exercise-log-body">
      ${entry ? `<ul class="exercise-inline-instructions" aria-label="${esc(e.name)} instructions">${(entry.instructions.quickSteps || entry.instructions.steps).map((step) => `<li>${esc(step)}</li>`).join("")}</ul>` : ""}
      <div class="exercise-guide-link">${exerciseGuideButton(e.name, esc)}</div>
      <p class="log-target-description">Target: ${e.sets} × ${e.target} ${e.mode === "time" ? "sec" : "reps"}${e.weight ? ` at ${e.weight} ${state.unit}` : ""}</p>
      <label class="exercise-notes"><span class="visually-hidden">Notes for ${esc(e.name)}</span><textarea aria-label="Notes for ${esc(e.name)}" data-exercise-note="${esc(e.id)}" maxlength="1000" rows="1" placeholder="Add note…">${esc(e.note || "")}</textarea></label>
      ${previousPerformanceHeader(w, e)}
      <div class="log-head"><span>Set</span><span>Previous</span><span>Lbs</span><span>${e.mode === "time" ? "Sec" : "Reps"}</span><span class="log-done-heading">Done</span></div>
      ${e.logs
        .map(
          (l, i) => `<div class="log-row ${l.done ? "set-done" : ""}">
        <strong class="log-set-number">${i + 1}</strong>
        ${previousSetCell(e, i, history)}
        <div class="log-input-cell"><input aria-label="${esc(e.name)} set ${i + 1} weight" type="number" inputmode="decimal" min="0" max="5000" step="0.01" placeholder="${e.weight}" value="${esc(l.weight === "" ? e.weight : l.weight)}" data-eid="${e.id}" data-set="${i}" data-field="weight"></div>
        <div class="log-input-cell"><input aria-label="${esc(e.name)} set ${i + 1} ${e.mode === "time" ? "seconds" : "reps"}" type="number" inputmode="numeric" min="0" max="10000" step="1" placeholder="${e.target}" value="${esc(l.actual === "" ? e.target : l.actual)}" data-eid="${e.id}" data-set="${i}" data-field="actual"></div>
        <input aria-label="${esc(e.name)} set ${i + 1} completed" type="checkbox" ${l.done ? "checked" : ""} data-eid="${e.id}" data-set="${i}" data-field="done">
      </div>`,
        )
        .join("")}
      <button type="button" class="text-button add-set" data-action="add-set" data-id="${w.id}" data-eid="${e.id}" aria-label="Add set to ${esc(e.name)}" ${e.sets >= 30 ? "disabled" : ""}>+ Add set</button>
      ${e.sets >= 30 ? '<p class="field-help">Maximum of 30 sets per exercise.</p>' : ""}
    </div>
  </details>`;
}
function logForm(w) {
  return `<section class="inline-workout-log" data-workout-id="${esc(w.id)}">${workoutHistory(w)}<p class="log-intro" role="status">Adjust your results, then check each completed set. Mark as complete accepts all displayed results.</p><form class="log-form">${w.exercises.map((e, index) => exerciseLog(w, e, index)).join("") || "<p>Add an exercise to your plan to start logging.</p>"}<div class="modal-footer"><span class="autosave">Changes save automatically</span>${w.exercises.length && !isWorkoutComplete(w) ? `<button type="button" class="button primary" data-action="complete-workout" data-id="${w.id}">Mark as complete</button>` : ""}</div></form></section>`;
}
// Read and validate every affected input before changing any saved set.
function logRoot() {
  return (
    [...app.querySelectorAll(".inline-workout-log")].find(
      (root) => root.dataset.workoutId === active,
    ) || app
  );
}
function completeExercises(exercises, done = true) {
  const updates = [];
  for (const e of exercises) {
    for (let i = 0; i < e.logs.length; i++) {
      const row = [...logRoot().querySelectorAll(".log-row")].find((row) => {
        const field = row.querySelector('[data-field="weight"]');
        return field.dataset.eid === e.id && Number(field.dataset.set) === i;
      });
      const weight = row.querySelector('[data-field="weight"]');
      const actual = row.querySelector('[data-field="actual"]');
      if (done) {
        for (const field of [weight, actual]) {
          if (!field.checkValidity() || field.value === "") {
            logRoot().querySelector(".log-intro").textContent =
              "Enter both weight (0 for bodyweight) and reps or seconds for every set before completing.";
            const accordion = field.closest(".exercise-accordion");
            if (accordion) accordion.open = true;
            field.reportValidity();
            field.focus();
            return false;
          }
        }
      }
      updates.push({
        log: e.logs[i],
        weight: weight.value,
        actual: actual.value,
      });
    }
  }
  for (const update of updates) {
    if (done) {
      update.log.weight = update.weight;
      update.log.actual = update.actual;
    }
    update.log.done = done;
  }
  save();
  return true;
}
app.addEventListener("click", (event) => {
  const b = event.target.closest("button");
  if (!b) return;
  if (b.dataset.tab) {
    loggingWorkouts.clear();
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
  if (a === "landing-signin" || a === "landing-signup") {
    cloud.open(a === "landing-signup" ? "signup" : "signin");
    return;
  }
  if (a === "retry-start") {
    startApp();
    return;
  }
  if (a === "copy-mcp") {
    copyAiEndpoint(app);
    return;
  }
  if (a === "exercise-guide") {
    showExerciseGuide(b.dataset.libraryId, esc);
    return;
  }
  if (a === "choose-exercise" || a === "choose-custom-exercise") {
    const form = app.querySelector("#exercise-form");
    const choice =
      a === "choose-exercise" ? findLibraryExercise(b.dataset.libraryId) : null;
    form.elements.name.value = choice ? choice.name : b.dataset.exerciseName;
    if (choice && form.elements.mode.value !== choice.mode) {
      form.elements.mode.value = choice.mode;
      form.elements.target.value = choice.mode === "time" ? 45 : 10;
    }
    form.querySelector(".exercise-library").open = false;
    form.elements.name.focus();
    return;
  }
  if (a === "start-program") {
    const id = b.dataset.program;
    if (state.programs.some((p) => p.id === id)) {
      state.activeProgramId = id;
      tab = "home";
      save();
      window.scrollTo(0, 0);
    }
  }
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
    if (state.activeProgramId === selectedProgramId)
      delete state.activeProgramId;
    selectedProgramId = null;
    modal = null;
    save();
  }
  if (a === "import-program") {
    importer.open();
    return;
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
  if (a === "log") {
    if (loggingWorkouts.has(active)) loggingWorkouts.delete(active);
    else {
      loggingWorkouts.add(active);
      openExerciseIds.set(
        active,
        new Set(workout().exercises.length ? [workout().exercises[0].id] : []),
      );
    }
  }
  if (a === "expand-exercise") {
    loggingWorkouts.add(active);
    openExerciseIds.set(active, new Set([b.dataset.eid]));
  }
  if (a === "add-set") {
    const e = workout().exercises.find((e) => e.id === b.dataset.eid);
    if (e.sets < 30) {
      e.sets += 1;
      e.logs.push({ weight: "", actual: "", done: false });
      openExerciseIds.get(active)?.add(e.id);
      save();
    }
  }
  if (a === "complete-workout") {
    if (!completeExercises(workout().exercises)) return;
    modal = null;
    loggingWorkouts.clear();
    if (tab !== "home") tab = "history";
  }
  if (a === "supersets") modal = { type: "supersets", group: "" };
  if (a === "remove-superset") {
    for (const e of workout().exercises)
      if (e.group === modal.group) e.group = "";
    sortSupersets(workout());
    modal = null;
    save();
  }
  if (a === "add-exercise") modal = { type: "exercise" };
  if (a === "edit-exercise") modal = { type: "exercise", eid: b.dataset.eid };
  if (a === "swap-exercise") modal = { type: "swap", eid: b.dataset.eid };
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
  if (form.id === "superset-form") {
    try {
      saveSuperset(
        workout(),
        modal.group || "",
        data.group,
        new FormData(form).getAll("exercise"),
      );
      modal = null;
      save();
      render();
    } catch (error) {
      form.querySelector(".form-error").textContent = error.message;
    }
    return;
  }
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
    if (
      modal.type === "swap" &&
      old.logs.some((log) => log.done || log.weight !== "" || log.actual !== "")
    ) {
      form.querySelector(".exercise-swap-message").textContent =
        "This exercise has recorded results. Add a new exercise to keep those results with the original movement.";
      return;
    }
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
      if (old.note !== undefined) e.note = old.note;
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
app.addEventListener(
  "toggle",
  (event) => {
    const details = event.target;
    if (!details.matches(".exercise-accordion")) return;
    const id = details.closest(".inline-workout-log").dataset.workoutId;
    if (!openExerciseIds.has(id)) openExerciseIds.set(id, new Set());
    if (details.open) {
      for (const other of details
        .closest(".inline-workout-log")
        .querySelectorAll(".exercise-accordion")) {
        if (other !== details) other.open = false;
      }
      openExerciseIds.set(id, new Set([details.dataset.exerciseId]));
    } else openExerciseIds.get(id).delete(details.dataset.exerciseId);
  },
  true,
);
app.addEventListener("input", (event) => {
  const input = event.target;
  if (input.closest(".inline-workout-log"))
    active = input.closest(".inline-workout-log").dataset.workoutId;
  if (input.dataset.exerciseNote) {
    if (!input.checkValidity()) {
      input.reportValidity();
      return;
    }
    const exercise = workout().exercises.find(
      (e) => e.id === input.dataset.exerciseNote,
    );
    exercise.note = input.value;
    save();
    return;
  }
  if (event.target.id === "exercise-search")
    renderExerciseResults(app, state, esc);
  if (
    event.target.name === "name" &&
    event.target.form?.id === "exercise-form"
  ) {
    const library = app.querySelector(".exercise-library");
    if (!library) return;
    library.open = true;
    app.querySelector("#exercise-search").value = event.target.value;
    app.querySelector("#exercise-category").value = "";
    renderExerciseResults(app, state, esc);
  }
});
app.addEventListener("change", (event) => {
  const input = event.target;
  if (input.closest(".inline-workout-log"))
    active = input.closest(".inline-workout-log").dataset.workoutId;
  if (input.id === "mobile-page-select") {
    loggingWorkouts.clear();
    tab = input.value;
    render();
    window.scrollTo(0, 0);
    return;
  }
  if (input.id === "superset-picker") {
    modal.group = input.value;
    render();
    return;
  }
  if (input.id === "exercise-category") {
    renderExerciseResults(app, state, esc);
    return;
  }
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
    if (input.checked) {
      const row = input.closest(".log-row"),
        weight = row.querySelector('[data-field="weight"]'),
        actual = row.querySelector('[data-field="actual"]');
      if (!weight.checkValidity() || !actual.checkValidity()) {
        input.checked = false;
        (!weight.checkValidity() ? weight : actual).reportValidity();
        return;
      }
      if (weight.value === "" || actual.value === "") {
        input.checked = false;
        logRoot().querySelector(".log-intro").textContent =
          "Enter both weight (0 for bodyweight) and reps or seconds before completing a set.";
        (weight.value === "" ? weight : actual).focus();
        return;
      }
      log.weight = weight.value;
      log.actual = actual.value;
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
  const progressLabel = input
    .closest(".exercise-accordion")
    ?.querySelector(".exercise-set-progress");
  if (progressLabel)
    progressLabel.textContent = `${e.logs.filter((log) => log.done).length}/${e.sets} sets logged`;
  for (const button of logRoot().querySelectorAll(
    '[data-action="swap-exercise"]',
  )) {
    if (button.dataset.eid === e.id)
      button.disabled = e.logs.some(
        (log) => log.done || log.weight !== "" || log.actual !== "",
      );
  }
  save();
});
document.addEventListener("keydown", (e) => {
  if (document.querySelector("#exercise-guide[open]")) return;
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
    state = inPounds(next);
    loggingWorkouts.clear();
    openExerciseIds.clear();
    modal = null;
    active = null;
    render();
  },
  canApply: () => !modal && !app.querySelector(".inline-workout-log"),
  onStatus: (label) => {
    const el = document.querySelector("#sync-label");
    if (el) el.textContent = label;
  },
});
const importer = createProgramImporter({
  getState: () => state,
  commit: (next, id) => {
    state = inPounds(next);
    selectedProgramId = id;
    selectedProgramWeek = 1;
    tab = "programs";
    save();
    render();
  },
});
async function startApp() {
  initializing = true;
  startupError = false;
  render();
  const result = await cloud.start();
  initializing = false;
  startupError = !result.ok;
  render();
}
startApp();

setupPwa();
