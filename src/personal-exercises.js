import { addPersonalExercise } from "../shared/personal-exercises.js";
export function newExerciseDialog({ name, state, save, choose, esc }) {
  document.querySelector("#personal-exercise-dialog")?.remove();
  const dialog = document.createElement("dialog");
  dialog.id = "personal-exercise-dialog";
  dialog.className = "exercise-guide-dialog";
  dialog.setAttribute("aria-labelledby", "personal-exercise-title");
  dialog.innerHTML = `<form><div class="eyebrow">YOUR PERSONAL LIBRARY</div><h2 id="personal-exercise-title">Add New Exercise</h2><p>Only you will see this exercise in search results.</p><label>Exercise name<input name="name" required maxlength="100" value="${esc(name)}"></label><label>Instructions<textarea name="instructions" required maxlength="3000" rows="4" placeholder="Explain how to perform this exercise"></textarea></label><label>YouTube video link <span class="optional">optional</span><input name="videoUrl" type="url" maxlength="1000" placeholder="https://www.youtube.com/watch?v=…"></label><label>Track by<select name="mode"><option value="reps">Repetitions</option><option value="time">Time (seconds)</option></select></label><label class="personal-weight-option"><input type="checkbox" name="weighted" checked> Track weight (lbs)</label><p class="form-error" role="alert"></p><div class="modal-footer"><button type="button" class="button subtle" data-cancel>Cancel</button><button type="submit" class="button primary">Save exercise</button></div></form>`;
  document.body.append(dialog);
  dialog.addEventListener("close", () => dialog.remove(), { once: true });
  dialog.querySelector("[data-cancel]").onclick = () => dialog.close();
  dialog.querySelector("form").onsubmit = (event) => {
    event.preventDefault();
    const data = new FormData(event.target);
    try {
      const definition = addPersonalExercise(state, {
        name: data.get("name"),
        instructions: data.get("instructions"),
        mode: data.get("mode"),
        videoUrl: data.get("videoUrl"),
        weighted: data.has("weighted"),
      });
      save();
      choose(definition);
      dialog.close();
    } catch (error) {
      dialog.querySelector(".form-error").textContent = error.message;
    }
  };
  dialog.showModal();
}
