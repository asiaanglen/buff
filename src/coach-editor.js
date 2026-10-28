import { exerciseCatalog } from "../shared/exercises.js";
import { programEnd } from "../shared/programs.js";
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const recorded = (e) =>
  e.logs?.some((l) => l.done || l.weight !== "" || l.actual !== "") ||
  Boolean(e.note);
export function editClientWorkout(workout, program, customExercises, save) {
  const definitions = [
    ...exerciseCatalog.map((e) => ({ ...e, key: "library:" + e.id })),
    ...customExercises.map((e) => ({ ...e, key: "custom:" + e.id })),
  ];
  const dialog = document.createElement("dialog");
  dialog.className = "exercise-guide-dialog coach-plan-dialog";
  let changed = false,
    saving = false;
  dialog.innerHTML = `<div class="modal-header"><h2>Edit client workout</h2><button type="button" class="icon-button" data-close aria-label="Close workout editor">×</button></div><p>${esc(workout.name)} · Changes apply only to this client. Recorded results are preserved.</p><form><label>Workout date<input name="date" type="date" required min="${program.startDate}" max="${programEnd(program)}" value="${workout.date}"></label><label>Workout notes<textarea name="note" maxlength="500">${esc(workout.note)}</textarea></label><div data-rows></div><datalist id="coach-library-options">${definitions.map((d) => `<option value="${esc(d.name)}">${d.custom ? "My exercise" : d.category}</option>`).join("")}</datalist><button type="button" class="button subtle" data-add>+ Add exercise</button><p class="form-error" role="alert"></p><div class="coach-actions"><button type="submit" class="button primary">Save client workout</button><button type="button" class="button subtle" data-close>Cancel</button></div></form>`;
  const rows = dialog.querySelector("[data-rows]");
  function addRow(e) {
    const row = document.createElement("fieldset");
    row.dataset.row = "";
    row.dataset.id = e?.id || "";
    const locked = e && recorded(e);
    row.innerHTML = `<legend>${esc(e?.name || "New exercise")}</legend><div class="coach-actions"><button type="button" class="text-button" data-swap ${locked ? "disabled" : ""}>Swap exercise</button><button type="button" class="text-button" data-up aria-label="Move ${esc(e?.name || "exercise")} up">↑ Move up</button><button type="button" class="text-button" data-down aria-label="Move ${esc(e?.name || "exercise")} down">↓ Move down</button><button type="button" class="text-button danger" data-remove ${locked ? "disabled" : ""}>Remove exercise</button></div>${locked ? "<small>Recorded results are kept. Add a replacement instead of swapping or removing this exercise.</small>" : ""}<label data-picker ${e ? "hidden" : ""}>Search exercise library<input data-definition list="coach-library-options" autocomplete="off" maxlength="100" placeholder="Type an exercise name" ${e ? "" : "required"}></label><div class="form-grid"><label>Sets<input data-sets type="number" required min="1" max="30" value="${e?.sets || 3}"></label><label>Track by<select data-mode ${locked ? "disabled" : ""}><option value="reps">Repetitions</option><option value="time" ${e?.mode === "time" ? "selected" : ""}>Time (seconds)</option></select></label><label>Target per set<input data-target type="number" required min="1" max="10000" step="any" value="${e?.target || 10}"></label><label>Planned weight (lbs)<input data-weight type="number" required min="0" max="5000" step="0.01" value="${e?.weight || 0}"></label></div><label>Superset group<input data-group maxlength="12" value="${esc(e?.group || "")}" placeholder="e.g. A"></label>`;
    row.querySelector("[data-swap]").onclick = () => {
      row.querySelector("[data-picker]").hidden = false;
      row.querySelector("[data-definition]").focus();
    };
    row.querySelector("[data-definition]").onchange = (event) => {
      const d = definitions.find(
        (d) => d.name.toLowerCase() === event.target.value.trim().toLowerCase(),
      );
      if (d) {
        row.querySelector("legend").textContent = d.name;
        row.querySelector("[data-mode]").value = d.mode;
        if (d.weighted === false) row.querySelector("[data-weight]").value = 0;
      }
    };
    row.querySelector("[data-remove]").onclick = () => {
      row.remove();
      changed = true;
    };
    row.querySelector("[data-up]").onclick = () => {
      if (row.previousElementSibling)
        rows.insertBefore(row, row.previousElementSibling);
      changed = true;
    };
    row.querySelector("[data-down]").onclick = () => {
      if (row.nextElementSibling)
        rows.insertBefore(row.nextElementSibling, row);
      changed = true;
    };
    rows.append(row);
  }
  workout.exercises.forEach(addRow);
  dialog.querySelector("[data-add]").onclick = () => {
    addRow();
    changed = true;
    rows.lastElementChild.querySelector("[data-definition]").focus();
  };
  dialog.addEventListener("input", () => {
    changed = true;
  });
  dialog.addEventListener("change", () => {
    changed = true;
  });
  const close = () => {
    if (!saving && (!changed || confirm("Discard unsaved workout changes?")))
      dialog.close();
  };
  dialog.querySelectorAll("[data-close]").forEach((b) => (b.onclick = close));
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });
  return new Promise((resolve) => {
    let result = null;
    dialog.addEventListener(
      "close",
      () => {
        dialog.remove();
        resolve(result);
      },
      { once: true },
    );
    dialog.querySelector("form").onsubmit = async (event) => {
      event.preventDefault();
      const form = event.target;
      if (!form.reportValidity() || saving) return;
      const buttons = [...dialog.querySelectorAll("button")];
      const previous = buttons.map((b) => b.disabled);
      try {
        const exercises = [...rows.children].map((row) => {
          const name = row.querySelector("[data-definition]").value.trim();
          const definition = name
            ? definitions.find(
                (d) => d.name.toLowerCase() === name.toLowerCase(),
              )
            : null;
          if (name && !definition)
            throw Error(
              "Choose a matching exercise from the library suggestions.",
            );
          return {
            id: row.dataset.id || undefined,
            definitionId: definition?.key,
            sets: Number(row.querySelector("[data-sets]").value),
            mode: row.querySelector("[data-mode]").value,
            target: Number(row.querySelector("[data-target]").value),
            weight: Number(row.querySelector("[data-weight]").value),
            group: row.querySelector("[data-group]").value.trim(),
          };
        });
        saving = true;
        buttons.forEach((b) => (b.disabled = true));
        result = await save({
          editPlan: true,
          date: form.elements.date.value,
          note: form.elements.note.value,
          exercises,
        });
        changed = false;
        dialog.close();
      } catch (e) {
        form.querySelector(".form-error").textContent = e.message;
        buttons.forEach((b, i) => (b.disabled = previous[i]));
      } finally {
        saving = false;
      }
    };
    document.body.append(dialog);
    dialog.showModal();
  });
}
