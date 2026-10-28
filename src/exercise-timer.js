const remaining = (timer) =>
  timer.deadline === null
    ? timer.remaining
    : Math.max(0, timer.deadline - Date.now());
const display = (milliseconds) => {
  const seconds = Math.ceil(milliseconds / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};
export function createExerciseTimers(root) {
  const timers = new Map();
  let interval = null;
  function update() {
    for (const timer of timers.values()) {
      if (timer.deadline !== null && remaining(timer) === 0) {
        timer.deadline = null;
        timer.remaining = 0;
        timer.finished = true;
      }
    }
    for (const element of root.querySelectorAll("[data-countdown]")) {
      const timer = timers.get(element.dataset.countdown);
      if (!timer) continue;
      element.querySelector("output").textContent = display(remaining(timer));
      const toggle = element.querySelector('[data-timer-control="toggle"]');
      toggle.textContent =
        timer.deadline !== null
          ? "Pause"
          : timer.finished
            ? "Start again"
            : "Start";
      toggle.setAttribute(
        "aria-label",
        `${timer.deadline !== null ? "Pause" : "Start"} ${timer.name} timer`,
      );
      const status = timer.finished
        ? "Time’s up! Check off your set when you’re ready."
        : timer.deadline !== null
          ? "Counting down"
          : remaining(timer) < timer.duration
            ? "Paused"
            : "Ready";
      const message = element.querySelector("[data-timer-status]");
      if (message.textContent !== status) message.textContent = status;
      element.classList.toggle("timer-finished", timer.finished);
    }
    if (
      ![...timers.values()].some((t) => t.deadline !== null) &&
      interval !== null
    ) {
      clearInterval(interval);
      interval = null;
    }
  }
  root.addEventListener("click", (event) => {
    const button = event.target.closest("[data-timer-control]");
    if (!button) return;
    event.preventDefault();
    const timer = timers.get(
      button.closest("[data-countdown]").dataset.countdown,
    );
    if (!timer) return;
    if (button.dataset.timerControl === "reset") {
      timer.deadline = null;
      timer.remaining = timer.duration;
      timer.finished = false;
    } else if (timer.deadline !== null) {
      timer.remaining = remaining(timer);
      timer.deadline = null;
    } else {
      // Keep a single running set timer so different exercises cannot compete.
      for (const other of timers.values()) {
        if (other.deadline !== null) {
          other.remaining = remaining(other);
          other.deadline = null;
        }
      }
      if (timer.remaining === 0) timer.remaining = timer.duration;
      timer.finished = false;
      timer.deadline = Date.now() + timer.remaining;
      if (interval === null) interval = setInterval(update, 200);
    }
    update();
  });
  document.addEventListener("visibilitychange", update);
  window.addEventListener("pageshow", update);
  return {
    markup(workout, exercise, esc) {
      if (exercise.mode !== "time") return "";
      const id = JSON.stringify([workout.id, exercise.id]);
      let timer = timers.get(id);
      if (
        !timer ||
        timer.duration !== exercise.target * 1000 ||
        timer.name !== exercise.name
      ) {
        timer = {
          workoutId: workout.id,
          exerciseId: exercise.id,
          name: exercise.name,
          duration: exercise.target * 1000,
          remaining: exercise.target * 1000,
          deadline: null,
          finished: false,
        };
        timers.set(id, timer);
      }
      return `<section class="exercise-countdown ${timer.finished ? "timer-finished" : ""}" data-countdown="${esc(id)}" aria-label="${esc(exercise.name)} set timer"><div class="timer-heading"><span>Set timer · ${exercise.target} seconds</span><output role="timer" aria-label="${esc(exercise.name)} countdown" aria-live="off">${display(remaining(timer))}</output></div><div class="timer-controls"><button type="button" class="button primary" data-timer-control="toggle" aria-label="${timer.deadline !== null ? "Pause" : "Start"} ${esc(exercise.name)} timer">${timer.deadline !== null ? "Pause" : timer.finished ? "Start again" : "Start"}</button><button type="button" class="button subtle" data-timer-control="reset" aria-label="Reset ${esc(exercise.name)} timer">Reset</button></div><p data-timer-status role="status">${timer.finished ? "Time’s up! Check off your set when you’re ready." : timer.deadline !== null ? "Counting down" : remaining(timer) < timer.duration ? "Paused" : "Ready"}</p></section>`;
    },
    reconcile(state) {
      for (const [key, timer] of timers) {
        const e = state.workouts
          .find((w) => w.id === timer.workoutId)
          ?.exercises.find((e) => e.id === timer.exerciseId);
        if (
          !e ||
          e.mode !== "time" ||
          e.target * 1000 !== timer.duration ||
          e.name !== timer.name
        )
          timers.delete(key);
      }
      update();
    },
    clear() {
      timers.clear();
      if (interval !== null) clearInterval(interval);
      interval = null;
    },
  };
}
