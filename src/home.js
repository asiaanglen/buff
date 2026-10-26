import { progress, programWeek } from "./model.js";
export function isWorkoutComplete(workout) {
  const { total, done } = progress(workout);
  return total > 0 && total === done;
}
export function homeView({ state, workoutCard, esc, dateLabel }) {
  const program = (state.programs || []).find(
    (p) => p.id === state.activeProgramId,
  );
  if (!program)
    return `<section class="empty"><h2>Choose your next program.</h2><p>Start a program from your library to see your next workout here.</p><button class="button primary" data-tab="programs">Browse programs →</button></section>`;
  const workouts = state.workouts
    .filter((w) => w.programId === program.id)
    .sort((a, b) => a.date.localeCompare(b.date));
  const next = workouts.find((w) => !isWorkoutComplete(w));
  const done = workouts.filter(isWorkoutComplete).length;
  return `<section class="active-program"><div class="program-week-heading"><div><div class="eyebrow">YOUR ACTIVE PROGRAM</div><h2>${esc(program.name)}</h2><p>${done} of ${workouts.length} workouts completed · ${program.weeks} weeks</p></div><button class="button subtle" data-action="open-program" data-program="${esc(program.id)}">View program</button></div><section class="next-workout" aria-label="Next workout"><div class="eyebrow">${next ? `UP NEXT · WEEK ${programWeek(program, next.date)} · ${dateLabel(next.date)}` : workouts.length ? "PROGRAM COMPLETE" : "READY TO GET STARTED"}</div>${next ? workoutCard(next) : `<div class="empty"><h2>${workouts.length ? "Every workout completed. Well done!" : "Add your first workout."}</h2><p>${workouts.length ? "Your logs are saved. Choose another program whenever you’re ready." : "Open your program to plan your workouts."}</p><button class="button primary" data-action="open-program" data-program="${esc(program.id)}">Open program →</button></div>`}</section><h2 class="home-workouts-title">Your program workouts</h2><div class="program-workout-list">${workouts.map((w) => `<article class="home-workout ${isWorkoutComplete(w) ? "workout-complete" : ""} ${w.id === next?.id ? "workout-next" : ""}"><div><small>Week ${programWeek(program, w.date)} · ${dateLabel(w.date)} · ${isWorkoutComplete(w) ? "Completed ✓" : w.id === next?.id ? "Up next" : "Upcoming"}</small><h3>${esc(w.name)}</h3></div><button class="button subtle" data-action="log" data-id="${esc(w.id)}">${isWorkoutComplete(w) ? "View log" : "Log workout"} →</button></article>`).join("")}</div></section>`;
}
