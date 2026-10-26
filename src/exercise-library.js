import {
  exerciseCatalog,
  searchExercises,
  exerciseByName,
} from "../shared/exercises.js";
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
          `<div class="exercise-library-item"><button type="button" class="exercise-choice" data-action="choose-exercise" data-library-id="${esc(e.id)}"><strong>${esc(e.name)}</strong><small>${esc(e.category)} · ${esc(e.equipment)} · ${e.mode === "time" ? "Timed" : "Reps"}</small></button><button type="button" class="exercise-guide-button" data-action="exercise-guide" data-library-id="${esc(e.id)}" aria-label="How to: ${esc(e.name)}">How to</button></div>`,
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

export function exerciseGuideButton(name, esc) {
  const exercise = exerciseByName(name);
  return exercise
    ? `<button type="button" class="exercise-guide-button" data-action="exercise-guide" data-library-id="${esc(exercise.id)}" aria-label="How to: ${esc(exercise.name)}">How to</button>`
    : "";
}
export function showExerciseGuide(id, esc) {
  const exercise = findLibraryExercise(id);
  if (!exercise) return;
  let dialog = document.querySelector("#exercise-guide");
  if (!dialog) {
    dialog = document.createElement("dialog");
    dialog.id = "exercise-guide";
    dialog.className = "exercise-guide-dialog";
    dialog.setAttribute("aria-labelledby", "exercise-guide-title");
    document.body.append(dialog);
  }
  dialog.innerHTML = `<div class="eyebrow">EXERCISE GUIDE</div><h2 id="exercise-guide-title">${esc(exercise.name)}</h2><p>${esc(exercise.category)} · ${esc(exercise.equipment)}</p><h3>How to do it</h3><ol>${exercise.instructions.steps.map((step) => `<li>${esc(step)}</li>`).join("")}</ol><h3>Form cue</h3>${exercise.instructions.cues.map((cue) => `<p>${esc(cue)}</p>`).join("")}<button type="button" class="button primary" id="close-exercise-guide">Close instructions</button>`;
  dialog
    .querySelector("#close-exercise-guide")
    .addEventListener("click", () => dialog.close());
  dialog.showModal();
}
