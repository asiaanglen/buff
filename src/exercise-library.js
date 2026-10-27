import {
  exerciseCatalog,
  searchExercises,
  exerciseByName,
} from "../shared/exercises.js";
export function exerciseLibrary() {
  return `<div class="exercise-suggestions"><div id="exercise-search-status" role="status"></div><div id="exercise-search-results" class="exercise-search-results"></div></div>`;
}
export function renderExerciseResults(root, state, esc) {
  const results = root.querySelector("#exercise-search-results");
  if (!results) return;
  const form = root.querySelector("#exercise-form");
  const query = form.elements.name.value.trim();
  const status = root.querySelector("#exercise-search-status");
  if (!query || form.dataset.pickedName === query) {
    status.textContent = "";
    results.innerHTML = "";
    return;
  }
  const { exercises } = searchExercises({ query, limit: 8 });
  const personal = (state.customExercises || [])
    .filter((e) => e.name.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 8);
  const count = exercises.length + personal.length;
  status.textContent = count ? "Choose an exercise" : "No matching exercises";
  results.innerHTML =
    exercises
      .map(
        (e) =>
          `<div class="exercise-library-item"><button type="button" class="exercise-choice" data-action="choose-exercise" data-library-id="${esc(e.id)}"><strong>${esc(e.name)}</strong><small>${esc(e.category)} · ${esc(e.equipment)} · ${e.mode === "time" ? "Timed" : "Reps"}</small></button><button type="button" class="exercise-guide-button" data-action="exercise-guide" data-library-id="${esc(e.id)}" aria-label="How to: ${esc(e.name)}">How to</button></div>`,
      )
      .join("") +
    personal
      .map(
        (e) =>
          `<button type="button" class="exercise-choice" data-action="choose-personal-exercise" data-personal-id="${esc(e.id)}"><strong>${esc(e.name)}</strong><small>Your library · ${e.mode === "time" ? "Timed" : "Reps"} · ${e.weighted ? "Weighted" : "Bodyweight"}</small></button>`,
      )
      .join("") +
    (!exerciseByName(query) &&
    !personal.some((e) => e.name.toLowerCase() === query.toLowerCase())
      ? `<button type="button" class="button subtle add-personal-exercise" data-action="new-personal-exercise">+ Add New Exercise</button>`
      : "");
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
