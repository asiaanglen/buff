import {
  daysApart,
  shiftDate,
  programWeek,
  programHasResults,
  validDate,
} from "../shared/programs.js";
function dateLabel(date) {
  return new Date(date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
export function alignmentPreview(state, programId, startDate, esc) {
  const program = (state.programs || []).find(
    (program) => program.id === programId,
  );
  if (!program || !validDate(startDate))
    return "<p>Choose a date to preview your first week.</p>";
  const workouts = state.workouts
    .filter(
      (workout) =>
        workout.programId === programId &&
        programWeek(program, workout.date) === 1,
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  return `<h3>Week 1 · ${esc(dateLabel(startDate))}</h3><p>Day 1 starts on this date. Later weeks keep the same spacing.</p>${
    workouts
      .slice(0, 7)
      .map(
        (workout) =>
          `<div class="alignment-workout"><strong>${esc(workout.name)}</strong><span>${esc(dateLabel(shiftDate(startDate, daysApart(program.startDate, workout.date))))}</span></div>`,
      )
      .join("") || "<p>No workouts planned for Week 1 yet.</p>"
  }${workouts.length > 7 ? `<p>Plus ${workouts.length - 7} more workouts.</p>` : ""}`;
}
export function programAlignmentDialog(state, programId, alignOnly, esc) {
  const program = state.programs.find((program) => program.id === programId);
  const recorded = programHasResults(programId, state.workouts);
  return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-header"><div><div class="eyebrow">YOUR PROGRAM, ON YOUR CALENDAR</div><h2 id="modal-title">${alignOnly ? "Align with Weekly planner" : "Start your program"}</h2></div><button type="button" class="icon-button close" data-action="close" aria-label="Close dialog">×</button></div><form id="start-program-form" data-program-id="${esc(program.id)}"><p class="field-help"><strong>${esc(program.name)}</strong> · ${program.weeks} weeks. Choose when Week 1 begins. Your workouts will appear on those dates in Weekly planner.</p><label>Week 1 start date<input type="date" name="startDate" required value="${program.startDate}" ${recorded ? "readonly" : ""}></label>${recorded ? '<p class="field-help">This program has recorded results, so its dates are kept to preserve your history. You can reschedule upcoming workouts individually in Weekly planner.</p>' : '<div class="alignment-date-actions"><button type="button" class="button subtle" data-action="alignment-monday" data-offset="0">This Monday</button><button type="button" class="button subtle" data-action="alignment-monday" data-offset="7">Next Monday</button></div><p class="field-help">Choose Monday to line up numbered program weeks with the planner’s Monday–Sunday weeks. Existing workouts keep their relative days; nothing is duplicated.</p>'}<div class="program-alignment-preview" aria-live="polite">${alignmentPreview(state, program.id, program.startDate, esc)}</div><p class="form-error" role="alert"></p><div class="modal-footer"><span></span><button class="button primary" type="submit">${alignOnly ? "Save alignment" : "Start program & align"} →</button></div></form></section></div>`;
}
