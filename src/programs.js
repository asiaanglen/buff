import {
  programWeek,
  programEnd,
  shiftDate,
  progress,
  MAX_PROGRAM_WEEKS,
} from "./model.js";
export function programsView({
  state,
  selectedId,
  week,
  workoutCard,
  esc,
  dateLabel,
}) {
  const program = (state.programs || []).find((p) => p.id === selectedId);
  if (!program) {
    return `<div class="program-library">${
      (state.programs || [])
        .map((p) => {
          const workouts = state.workouts.filter((w) => w.programId === p.id);
          const done = workouts.filter((w) => {
            const x = progress(w);
            return x.total > 0 && x.done === x.total;
          }).length;
          return `<article class="program-card"><div class="program-card-icon">▦</div><span class="tag">${p.weeks} WEEK${p.weeks === 1 ? "" : "S"}</span><h2>${esc(p.name)}</h2><p>${dateLabel(p.startDate)} – ${dateLabel(programEnd(p))}, ${new Date(programEnd(p) + "T12:00:00").getFullYear()}</p>${p.note ? `<p class="program-note">${esc(p.note)}</p>` : ""}<div class="program-meta"><span>${workouts.length} workouts</span><span>${done} completed</span></div><button class="text-button" data-action="share-program" data-program="${esc(p.id)}">Share program</button><button class="button primary" data-action="start-program" data-program="${esc(p.id)}">${state.activeProgramId === p.id ? "Continue program" : "Start program"} →</button>${!p.unenrolled ? `<button class="text-button danger" data-action="unenroll-program" data-program="${esc(p.id)}">Unenroll</button>` : `<span class="tag">Not enrolled</span>`}<button class="button subtle" data-action="open-program" data-program="${esc(p.id)}">View Program →</button></article>`;
        })
        .join("") ||
      `<div class="empty program-empty"><span>▦</span><h3>Your next chapter starts here.</h3><p>Create a 4-week block, a 10-week build, or a program of your own length.</p><button class="button primary" data-action="new-program">+ Create program</button></div>`
    }</div>`;
  }
  const workouts = state.workouts
    .filter(
      (w) =>
        w.programId === program.id && programWeek(program, w.date) === week,
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  const first = shiftDate(program.startDate, (week - 1) * 7),
    last = shiftDate(first, 6);
  const completed = workouts.reduce((n, w) => n + progress(w).done, 0),
    sets = workouts.reduce((n, w) => n + progress(w).total, 0);
  return `<section class="program-detail"><div class="program-toolbar"><button class="text-button" data-action="all-programs">← All programs</button><button class="button primary" data-action="start-program" data-program="${esc(program.id)}">${state.activeProgramId === program.id ? "Continue program" : "Start program"} →</button><button class="button subtle" data-action="align-program" data-program="${esc(program.id)}">Align with planner</button>${!program.unenrolled ? `<button class="text-button danger" data-action="unenroll-program" data-program="${esc(program.id)}">Unenroll</button>` : `<span class="tag">Not enrolled</span>`}<button class="button subtle" data-action="edit-program">Edit program</button><button class="button subtle" data-action="share-program" data-program="${esc(program.id)}">Share program</button></div>${program.note ? `<p class="program-description">${esc(program.note)}</p>` : ""}<div class="program-weeks" aria-label="Program weeks">${Array.from(
    { length: Math.min(program.weeks, 12) },
    (_, i) => {
      const n =
        program.weeks <= 12
          ? i + 1
          : Math.min(Math.max(1, week - 5), program.weeks - 11) + i;
      const count = state.workouts.filter(
        (w) => w.programId === program.id && programWeek(program, w.date) === n,
      ).length;
      return `<button class="week-chip ${n === week ? "selected" : ""}" data-action="program-week" data-week="${n}" aria-pressed="${n === week}"><strong>Week ${n}</strong><small>${count} workout${count === 1 ? "" : "s"}</small></button>`;
    },
  ).join(
    "",
  )}</div><div class="program-week-heading"><div><div class="eyebrow">${esc(program.name)}</div><h2>Week ${week}<span>${dateLabel(first)} – ${dateLabel(last)}</span></h2><p>${workouts.length} workout${workouts.length === 1 ? "" : "s"} · ${completed} of ${sets} sets completed</p></div><div class="program-week-controls"><label class="visually-hidden" for="program-week-picker">Go to program week</label><select id="program-week-picker">${Array.from({ length: program.weeks }, (_, i) => `<option value="${i + 1}" ${i + 1 === week ? "selected" : ""}>Week ${i + 1}</option>`).join("")}</select><button class="button subtle" data-action="copy-week" ${program.weeks < 2 || !workouts.length ? "disabled" : ""}>Copy week</button><button class="button primary" data-action="new-workout">+ Add workout</button></div></div>${workouts.map((w) => `<div class="program-workout-date">${new Date(w.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</div>${workoutCard(w)}`).join("") || `<div class="empty"><span>+</span><h3>A fresh week to make your own.</h3><p>Add your first workout to Week ${week}.</p><button class="button primary" data-action="new-workout">+ Add workout</button></div>`}</section>`;
}
export function programForm(program, defaultDate, esc) {
  return `<form id="program-form"><label>Program name<input name="name" required maxlength="100" value="${esc(program?.name || "")}" placeholder="e.g. 10-week strength build"></label><div class="form-grid"><label>Number of weeks<input name="weeks" type="number" required min="1" max="${MAX_PROGRAM_WEEKS}" step="1" value="${program?.weeks || 4}"></label><label>Start date<input name="startDate" type="date" required value="${program?.startDate || defaultDate}"></label></div><p class="field-help">Week 1 begins on your start date. Each following week is a separate 7-day block.</p><label>Program notes <span class="optional">optional</span><textarea name="note" maxlength="500" placeholder="Your goals, your focus, your plan…">${esc(program?.note || "")}</textarea></label><p class="form-error" role="alert"></p><div class="modal-footer">${program ? '<button type="button" class="text-button danger" data-action="delete-program">Delete program</button>' : "<span></span>"}<button class="button primary" type="submit">${program ? "Save program" : "Create program"} →</button></div></form>`;
}
