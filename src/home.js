import { programWeek } from "./model.js";
import {
  isWorkoutComplete,
  nextProgramWorkout,
  orderedProgramWorkouts,
} from "../shared/completion.js";
export { isWorkoutComplete };
export function homeView({ state, workoutCard, esc, workoutLog, isLogging }) {
  const program = (state.programs || []).find(
    (p) => p.id === state.activeProgramId,
  );
  const standalone = state.workouts.filter(
    (w) => !w.programId && !isWorkoutComplete(w),
  );
  const extras = standalone.length
    ? `<details class="other-workouts"><summary>Other workouts (${standalone.length})</summary><p>Your workouts outside a program are kept here.</p>${standalone.map(workoutCard).join("")}</details>`
    : "";
  if (!program)
    return `<section class="empty"><h2>Choose your next program.</h2><p>Start a program to see your next workout here. Train at your own pace—no calendar needed.</p><button class="button primary" data-tab="programs">Browse programs →</button></section>${extras}`;
  const workouts = orderedProgramWorkouts(state, program.id);
  const next = nextProgramWorkout(state);
  const done = workouts.filter(isWorkoutComplete).length;
  const skipped = workouts.filter((w) => w.skipped).length;
  return `<section class="active-program"><div class="program-week-heading"><div><div class="eyebrow">YOUR ACTIVE PROGRAM</div><h2>${esc(program.name)}</h2><p>${done} of ${workouts.length} workouts completed${skipped ? ` · ${skipped} skipped` : ""} · ${program.weeks} weeks</p></div><div class="active-program-links"><button class="button subtle" data-action="open-program" data-program="${esc(program.id)}">View program</button><button class="text-button" data-action="share-program" data-program="${esc(program.id)}">Share program</button></div></div><section class="next-workout" aria-label="Next workout"><div class="eyebrow">${next ? `UP NEXT · WEEK ${programWeek(program, next.date)} · WORKOUT ${workouts.indexOf(next) + 1}` : workouts.length ? "PROGRAM FINISHED" : "READY TO GET STARTED"}</div>${next ? workoutCard(next) : `<div class="empty"><h2>${workouts.length ? "You’ve reached the end of your program." : "Add your first workout."}</h2><p>${workouts.length ? `${done} completed · ${skipped} skipped. Your results are saved. You can restore a skipped workout below or choose another program.` : "Open your program to add workouts."}</p><button class="button primary" data-action="${workouts.length ? "all-programs" : "open-program"}" data-program="${esc(program.id)}">${workouts.length ? "Browse programs" : "View program"} →</button></div>`}</section><h2 class="home-workouts-title">Your program workouts</h2><div class="program-workout-list">${workouts.map((w, i) => `<article class="home-workout ${isWorkoutComplete(w) || w.skipped ? "workout-complete" : ""} ${w.id === next?.id ? "workout-next" : ""}"><div><small>Week ${programWeek(program, w.date)} · Workout ${i + 1} · ${w.skipped ? "Skipped" : isWorkoutComplete(w) ? "Completed ✓" : w.id === next?.id ? "Up next" : "Upcoming"}</small><h3>${esc(w.name)}</h3></div>${w.skipped ? `<button class="button subtle" data-action="restore-workout" data-id="${esc(w.id)}">Undo skip</button>` : `<button class="button subtle" data-action="log" data-id="${esc(w.id)}">${w.id === next?.id ? "View workout" : isLogging(w.id) ? "Collapse workout" : isWorkoutComplete(w) ? "View log" : "Start workout"} →</button>`}${!w.skipped && w.id !== next?.id ? workoutLog(w) : ""}</article>`).join("")}</div></section>${extras}`;
}
