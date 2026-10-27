import { monthDates } from "../shared/calendar.js";
import { programEnd } from "../shared/programs.js";
import { isWorkoutComplete } from "./home.js";
export function calendarWorkouts(workouts, esc, month = false) {
  return workouts
    .map((workout) => {
      const complete = isWorkoutComplete(workout);
      return `<div class="calendar-workout ${complete ? "calendar-workout-complete" : ""}" draggable="true" data-calendar-workout="${esc(workout.id)}" data-workout-name="${esc(workout.name)}" title="${esc(workout.name)}${complete ? " · Completed" : ""}"><span class="calendar-drag-handle" data-calendar-handle aria-hidden="true" title="Drag to move">⠿</span>${month ? `<button type="button" class="calendar-workout-name" data-day="${esc(workout.date)}" aria-label="View ${esc(workout.name)} on ${esc(workout.date)}">${esc(workout.name)}</button>` : `<span class="calendar-workout-name">${esc(workout.name)}</span>`}${complete ? '<span class="calendar-complete-mark" aria-label="Completed">✓</span>' : ""}</div>`;
    })
    .join("");
}
export function calendarToggle(view) {
  return `<div class="calendar-view-toggle" role="group" aria-label="Calendar view"><button type="button" data-action="calendar-view" data-view="week" aria-pressed="${view === "week"}">Week</button><button type="button" data-action="calendar-view" data-view="month" aria-pressed="${view === "month"}">Month</button></div>`;
}
export function weekCalendar({ state, week, selected, today, esc }) {
  const display = (date, options) =>
    new Date(date + "T12:00:00").toLocaleDateString("en-US", options);
  const dates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(week + "T12:00:00");
    date.setDate(date.getDate() + index);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  });
  return `<section class="calendar"><div class="section-title"><h2>Weekly schedule</h2>${calendarToggle("week")}</div><div class="week-controls"><button data-action="prev" aria-label="Previous week">‹</button><strong>${display(dates[0], { month: "short", day: "numeric" })} – ${display(dates[6], { month: "short", day: "numeric" })}, ${display(dates[6], { year: "numeric" })}</strong><button data-action="next" aria-label="Next week">›</button><button class="today" data-action="today">Today</button></div><p class="calendar-help">Drag a workout to another date using its ⠿ handle, or use Move on a workout below.</p><div class="days">${dates
    .map((date) => {
      const workouts = state.workouts.filter(
        (workout) => workout.date === date,
      );
      return `<div class="day ${date === selected ? "selected" : ""}" data-day="${date}" data-calendar-date="${date}"><button type="button" class="week-date-select" aria-label="${esc(display(date, { weekday: "long", month: "long", day: "numeric", year: "numeric" }))}" aria-pressed="${date === selected}"><span class="day-name">${display(date, { weekday: "short" })} ${date === today ? '<i class="today-dot"></i>' : ""}</span><strong>${Number(date.slice(-2))}</strong></button>${workouts.length ? `<div class="day-workouts">${calendarWorkouts(workouts, esc)}</div><small>${workouts.length > 1 ? `${workouts.length} workouts` : `${workouts[0].exercises.length} exercises`}</small>` : '<span class="rest-label">Rest & recharge</span>'}</div>`;
    })
    .join("")}</div></section>`;
}
export function monthCalendar({ state, month, selected, today, esc }) {
  const dates = monthDates(month);
  const label = new Date(month + "T12:00:00").toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  return `<section class="calendar month-calendar" aria-label="Monthly workout calendar"><div class="section-title"><h2>Workout calendar</h2>${calendarToggle("month")}</div><div class="month-controls week-controls"><button type="button" data-action="calendar-prev-month" aria-label="Previous month">‹</button><strong>${esc(label)}</strong><button type="button" data-action="calendar-next-month" aria-label="Next month">›</button><button type="button" class="today" data-action="today">Today</button></div><p class="calendar-help">Drag a workout to another date using its ⠿ handle. You can also select a day and use Move on a workout below.</p><div class="month-weekdays" aria-hidden="true">${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => `<span>${day}</span>`).join("")}</div><div class="month-grid">${dates
    .map(
      (date) =>
        `<div class="month-day ${date.slice(0, 7) !== month.slice(0, 7) ? "outside-month" : ""} ${date === selected ? "selected" : ""} ${date === today ? "is-today" : ""}" data-calendar-date="${date}"><button type="button" class="month-date" data-day="${date}" aria-label="${esc(new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }))}" ${date === today ? 'aria-current="date"' : ""} aria-pressed="${date === selected}">${Number(date.slice(-2))}</button>${calendarWorkouts(
          state.workouts.filter((workout) => workout.date === date),
          esc,
          true,
        )}</div>`,
    )
    .join("")}</div></section>`;
}
export function moveWorkoutDialog(state, workout, esc) {
  const program = state.programs?.find(
    (program) => program.id === workout.programId,
  );
  return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-header"><h2 id="modal-title">Move workout</h2><button type="button" class="icon-button close" data-action="close" aria-label="Close dialog">×</button></div><p>${esc(workout.name)}</p><form id="move-workout-form" data-workout-id="${esc(workout.id)}"><label>Workout date<input name="date" type="date" required value="${workout.date}" ${program ? `min="${program.startDate}" max="${programEnd(program)}"` : ""}></label><p class="field-help">Your exercises, logged results, and notes stay with this workout.</p><p class="form-error" role="alert"></p><div class="modal-footer"><button type="button" class="button subtle" data-action="close">Cancel</button><button type="submit" class="button primary">Move workout</button></div></form></section></div>`;
}
export function setupCalendarDrag(root, onMove) {
  let dragged = null,
    pointer = null,
    hovered = null,
    frame = null,
    suppressUntil = 0;
  function highlight(target) {
    const cell = target?.closest?.("[data-calendar-date]");
    if (hovered !== cell) {
      hovered?.classList.remove("calendar-drop-target");
      hovered = cell && root.contains(cell) ? cell : null;
      hovered?.classList.add("calendar-drop-target");
    }
  }
  function clear() {
    dragged = null;
    hovered?.classList.remove("calendar-drop-target");
    hovered = null;
    root
      .querySelectorAll(".calendar-source")
      .forEach((source) => source.classList.remove("calendar-source"));
    if (frame) cancelAnimationFrame(frame);
    frame = null;
    const previous = pointer;
    pointer = null;
    previous?.ghost?.remove();
    if (previous?.source.hasPointerCapture?.(previous.id))
      previous.source.releasePointerCapture(previous.id);
  }
  root.addEventListener("dragstart", (event) => {
    if (pointer) {
      event.preventDefault();
      return;
    }
    const source = event.target.closest("[data-calendar-workout]");
    if (!source) return;
    dragged = source.dataset.calendarWorkout;
    source.classList.add("calendar-source");
    event.dataTransfer.setData("text/plain", dragged);
    event.dataTransfer.effectAllowed = "move";
  });
  root.addEventListener("dragover", (event) => {
    if (!dragged || !event.target.closest("[data-calendar-date]")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    highlight(event.target);
  });
  root.addEventListener("drop", (event) => {
    const date = event.target.closest("[data-calendar-date]")?.dataset
      .calendarDate;
    if (!dragged || !date) return;
    event.preventDefault();
    const id = dragged;
    clear();
    suppressUntil = Date.now() + 300;
    onMove(id, date);
  });
  root.addEventListener("dragend", clear);
  root.addEventListener("pointerdown", (event) => {
    if (
      !event.isPrimary ||
      (event.pointerType === "mouse" && event.button !== 0)
    )
      return;
    const handle = event.target.closest("[data-calendar-handle]");
    const source = handle?.closest("[data-calendar-workout]");
    if (!source) return;
    event.preventDefault();
    pointer = {
      id: event.pointerId,
      source: handle,
      workout: source,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      moved: false,
    };
    handle.setPointerCapture(event.pointerId);
  });
  function paint() {
    if (!pointer?.moved) return;
    const { x, y, ghost } = pointer;
    ghost.style.left = `${x + 12}px`;
    ghost.style.top = `${y + 12}px`;
    highlight(document.elementFromPoint(x, y));
    if (y < 70) window.scrollBy(0, -10);
    else if (y > innerHeight - 70) window.scrollBy(0, 10);
    frame = requestAnimationFrame(paint);
  }
  root.addEventListener("pointermove", (event) => {
    if (!pointer || event.pointerId !== pointer.id) return;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    if (
      !pointer.moved &&
      Math.hypot(pointer.x - pointer.startX, pointer.y - pointer.startY) >= 6
    ) {
      pointer.moved = true;
      pointer.workout.classList.add("calendar-source");
      pointer.ghost = document.createElement("div");
      pointer.ghost.className = "calendar-drag-ghost";
      pointer.ghost.textContent = pointer.workout.dataset.workoutName;
      document.body.append(pointer.ghost);
      paint();
    }
    if (pointer.moved) {
      event.preventDefault();
      highlight(document.elementFromPoint(pointer.x, pointer.y));
    }
  });
  root.addEventListener("pointerup", (event) => {
    if (!pointer || event.pointerId !== pointer.id) return;
    const date = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest("[data-calendar-date]")?.dataset.calendarDate;
    const id = pointer.workout.dataset.calendarWorkout,
      moved = pointer.moved;
    const button =
      pointer.workout.closest("button[data-day]") ||
      pointer.workout.querySelector("button[data-day]") ||
      pointer.workout.closest("[data-day]")?.querySelector(".week-date-select");
    clear();
    if (moved) {
      event.preventDefault();
      suppressUntil = Date.now() + 300;
      if (date) onMove(id, date);
    } else button?.click();
  });
  root.addEventListener("pointercancel", (event) => {
    if (pointer && event.pointerId === pointer.id) clear();
  });
  root.addEventListener(
    "click",
    (event) => {
      if (Date.now() < suppressUntil && event.target.closest(".calendar")) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true,
  );
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && (dragged || pointer)) {
      event.preventDefault();
      clear();
    }
  });
  window.addEventListener("blur", clear);
  return { isDragging: () => Boolean(dragged || pointer) };
}
