export function supersetGroups(workout) {
  return [...new Set(workout.exercises.map((e) => e.group).filter(Boolean))];
}
export function nextSupersetGroup(workout) {
  const groups = new Set(supersetGroups(workout));
  for (let n = 0; n < 10000; n++) {
    const candidate = n < 26 ? String.fromCharCode(65 + n) : `S${n + 1}`;
    if (!groups.has(candidate)) return candidate;
  }
}
export function sortSupersets(workout) {
  const order = new Map();
  for (const exercise of workout.exercises) {
    const key = exercise.group || exercise.id;
    if (!order.has(key)) order.set(key, order.size);
  }
  workout.exercises.sort(
    (a, b) => order.get(a.group || a.id) - order.get(b.group || b.id),
  );
}
export function saveSuperset(workout, originalGroup, label, ids) {
  const group = label.trim().toUpperCase();
  if (!group || group.length > 12)
    throw Error("Enter a superset name of up to 12 characters.");
  if (group !== originalGroup && supersetGroups(workout).includes(group))
    throw Error(
      "That superset name is already in use. Choose it from the menu to edit it.",
    );
  const selected = new Set(ids);
  if (selected.size < 2)
    throw Error("Select at least two exercises for a superset.");
  if (
    [...selected].some(
      (id) =>
        !workout.exercises.some(
          (e) => e.id === id && (!e.group || e.group === originalGroup),
        ),
    )
  )
    throw Error("Choose ungrouped exercises or exercises in this superset.");
  for (const exercise of workout.exercises) {
    if (selected.has(exercise.id)) exercise.group = group;
    else if (originalGroup && exercise.group === originalGroup)
      exercise.group = "";
  }
  sortSupersets(workout);
}
export function supersetDialog(workout, selectedGroup, esc) {
  const groups = supersetGroups(workout);
  return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-header"><div><div class="eyebrow">TRAIN TOGETHER</div><h2 id="modal-title">Supersets</h2></div><button type="button" class="icon-button close" data-action="close" aria-label="Close dialog">×</button></div><p class="field-help">Choose two or more exercises to alternate within this workout. Each keeps its own sets, targets, results and notes.</p><form id="superset-form"><label for="superset-picker">Choose superset</label><select id="superset-picker"><option value="">Create new superset</option>${groups.map((group) => `<option value="${esc(group)}" ${group === selectedGroup ? "selected" : ""}>Superset ${esc(group)}</option>`).join("")}</select><label>Superset name<input name="group" required maxlength="12" value="${esc(selectedGroup || nextSupersetGroup(workout))}"></label><fieldset class="superset-choices"><legend>Exercises in this superset</legend>${workout.exercises.map((e) => `<label><input type="checkbox" name="exercise" value="${esc(e.id)}" ${selectedGroup && e.group === selectedGroup ? "checked" : ""} ${e.group && e.group !== selectedGroup ? "disabled" : ""}><span>${esc(e.name)}${e.group && e.group !== selectedGroup ? `<small>In Superset ${esc(e.group)}</small>` : ""}</span></label>`).join("") || "<p>Add at least two exercises to your workout first.</p>"}</fieldset><p class="form-error" role="alert"></p><div class="modal-footer">${selectedGroup ? '<button type="button" class="text-button danger" data-action="remove-superset">Remove superset</button>' : "<span></span>"}<button type="submit" class="button primary" ${workout.exercises.length < 2 ? "disabled" : ""}>${selectedGroup ? "Save superset" : "Create superset"} →</button></div></form></section></div>`;
}
