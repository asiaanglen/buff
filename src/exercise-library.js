import { exerciseCatalog, searchExercises } from "../shared/exercises.js";
export function exerciseLibrary(esc) {
  const categories = [...new Set(exerciseCatalog.map((e) => e.category))];
  return `<details class="exercise-library" open><summary>Choose from the exercise library</summary><p>Find a movement below, or enter your own exercise name.</p><label>Search exercises<input id="exercise-search" type="search" placeholder="e.g. squat, pull up, RDL" autocomplete="off"></label><label for="exercise-category">Muscle group</label><select id="exercise-category"><option value="">All groups</option>${categories.map((c) => `<option>${esc(c)}</option>`).join("")}</select><div id="exercise-search-status" role="status"></div><div id="exercise-search-results" class="exercise-search-results"></div></details>`;
}
export function renderExerciseResults(root, state, esc) {
  const results = root.querySelector("#exercise-search-results");
  if (!results) return;
  const query = root.querySelector("#exercise-search").value;
  const category = root.querySelector("#exercise-category").value;
  const { exercises, total } = searchExercises({ query, category, limit: 12 });
  // Private custom names are suggested only from this signed-in user's journal.
  const catalogNames = new Set(
    exerciseCatalog.map((e) => e.name.toLowerCase()),
  );
  const customNames = [
    ...new Set(state.workouts.flatMap((w) => w.exercises.map((e) => e.name))),
  ]
    .filter(
      (name) =>
        !catalogNames.has(name.toLowerCase()) &&
        !category &&
        query.trim() &&
        name.toLowerCase().includes(query.trim().toLowerCase()),
    )
    .slice(0, 5);
  root.querySelector("#exercise-search-status").textContent =
    `${total} library matches${total > 12 ? " · showing 12; type to narrow" : ""}`;
  results.innerHTML =
    exercises
      .map(
        (e) =>
          `<button type="button" class="exercise-choice" data-action="choose-exercise" data-library-id="${esc(e.id)}"><strong>${esc(e.name)}</strong><small>${esc(e.category)} · ${esc(e.equipment)} · ${e.mode === "time" ? "Timed" : "Reps"}</small></button>`,
      )
      .join("") +
      customNames
        .map(
          (name) =>
            `<button type="button" class="exercise-choice" data-action="choose-custom-exercise" data-exercise-name="${esc(name)}"><strong>${esc(name)}</strong><small>From your workouts</small></button>`,
        )
        .join("") ||
    '<p class="field-help">No matching exercises. You can still enter a custom name below.</p>';
}
export function findLibraryExercise(id) {
  return exerciseCatalog.find((e) => e.id === id);
}
