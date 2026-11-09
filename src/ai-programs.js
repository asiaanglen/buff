import { formatAiMessage } from "./ai-message-format.js";
import "./ai-programs.css";
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const today = () => {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
};

export function mountAiCoach({
  container: app,
  cloud,
  beforeSave,
  onSaved,
  onClose,
}) {
  let destroyed = false;
  const requests = new AbortController();
  let loading = true,
    busy = false,
    saving = false,
    status = null,
    draft = null,
    error = "",
    requestError = false;
  let draftOwner = null;
  let useHistory = false;
  let revisionText = "";
  let pendingMessage = "";
  async function api(path = "", options = {}) {
    const response = await fetch("/api/ai-programs" + path, {
      credentials: "same-origin",
      cache: "no-store",
      signal: AbortSignal.any([requests.signal, AbortSignal.timeout(95000)]),
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
    });
    const data = await response.json();
    if (!response.ok)
      throw Object.assign(
        Error(data.error || "Could not complete this request."),
        { status: response.status },
      );
    return data;
  }
  async function load() {
    loading = true;
    render();
    try {
      if (cloud.isSignedIn()) {
        const owner = cloud.account()?.id;
        const result = await api();
        if (!destroyed && cloud.account()?.id === owner) {
          status = result;
          if (draft && draftOwner === owner) {
            const latest = await api("/" + draft.id);
            if (cloud.account()?.id === owner) draft = latest;
          }
        }
      }
    } catch (e) {
      error = e.message;
      requestError = true;
    } finally {
      loading = false;
      render();
    }
  }
  function preview() {
    const plan = draft.plan;
    const byWeek = Array.from({ length: plan.program.weeks }, (_, i) => ({
      number: i + 1,
      workouts: plan.workouts.filter((w) => Math.floor(w.offset / 7) === i),
    }));
    return `<details class="ai-plan-attachment"><summary><strong>${esc(plan.program.name)}</strong><span>Review program · ${plan.program.weeks} weeks · ${plan.workouts.length} workouts</span></summary><section class="ai-panel ai-preview"><span class="tag">${draft.savedProgramId ? "SAVED TO YOUR PROGRAMS" : "DRAFT · NOT SAVED"}</span><h2>${esc(plan.program.name)}</h2><p>${esc(plan.program.note)}</p><p><strong>${plan.program.weeks} weeks · ${plan.workouts.length} workouts</strong> · Train at your own pace</p>${byWeek.map((week) => `<details class="ai-week" ${week.number === 1 ? "open" : ""}><summary>Week ${week.number}<span>${week.workouts.length} workouts</span></summary>${week.workouts.map((w) => `<article class="ai-workout"><div><h3>${esc(w.name)}</h3><span>Week ${week.number} · Workout ${week.workouts.indexOf(w) + 1}</span></div>${w.note ? `<p class="ai-week-note">${esc(w.note)}</p>` : ""}<ol>${w.exercises.map((e) => `<li><strong>${esc(e.name)}</strong><span>${e.sets} sets × ${e.target} ${e.mode === "time" ? "sec" : "reps"} · ${e.weight ? e.weight + " lbs suggested" : e.weighted === false ? "Bodyweight" : "Starting weight unassigned"}${e.group ? " · Superset " + esc(e.group) : ""}</span></li>`).join("")}</ol></article>`).join("")}</details>`).join("")}<div class="ai-save">${draft.savedProgramId ? '<p>Your program is saved. Start it whenever you’re ready.</p><button class="button primary" type="button" data-action="return-programs">View program</button>' : `<p>Saving adds a new program to your library. Enrollment and your current program stay unchanged.</p><button type="button" class="button primary" data-action="save" ${busy || saving ? "disabled" : ""}>${saving ? "Saving…" : "Save program"}</button>`}<button type="button" class="text-button" data-action="start-over" ${busy || saving ? "disabled" : ""}>Create a different program</button></div></section></details>`;
  }
  function chat() {
    const hasPlan = Boolean(draft?.plan),
      saved = Boolean(draft?.savedProgramId);
    const messages = draft?.conversation || [
      {
        role: "assistant",
        text: "Hi! I’m Buffy, your AI workout coach. What would you like to work toward? Tell me about your goals and where you train. We’ll build a program together.",
      },
    ];
    return `<section class="ai-chat"><h2 class="visually-hidden">Chat with Buffy</h2><div class="ai-messages" aria-label="Program conversation" aria-live="polite">${messages.map((m) => `<article class="ai-message ${m.role === "user" ? "ai-message-user" : ""}"><strong>${m.role === "user" ? "You" : "Buffy"}</strong>${m.role === "user" ? `<p>${esc(m.text)}</p>` : `<div class="ai-message-content">${formatAiMessage(m.text)}</div>`}</article>`).join("")}${draft?.plan ? preview() : ""}${busy ? `<article class="ai-message ai-message-user"><strong>You</strong><p>${esc(pendingMessage)}</p></article><p class="ai-thinking" role="status">Buffy is thinking…</p>` : ""}${saved ? '<p class="ai-chat-saved" role="status">Your program is saved! You can view it in Programs or start another conversation.</p>' : ""}${!draft ? `<div class="ai-starters"><button type="button" class="button subtle" data-action="starter" data-message="I want to build strength. Can you help me get started?">Build strength</button><button type="button" class="button subtle" data-action="starter" data-message="I want to lose weight and improve my fitness. Help me build a workout program.">Lose weight</button><button type="button" class="button subtle" data-action="starter" data-message="I want to build muscle with a program that fits my schedule.">Build muscle</button></div>${status?.drafts?.length ? `<details class="ai-recent"><summary>Previous conversations</summary>${status.drafts.map((d) => `<button class="button subtle ai-resume" data-action="resume" data-id="${d.id}">${esc(d.name)} · ${d.saved_program_id ? "Saved" : "Resume draft"}</button>`).join("")}</details>` : ""}` : ""}</div>${saved ? '<div class="ai-composer"><button class="button primary" data-action="return-programs">View program</button><button class="text-button" data-action="start-over">New conversation</button></div>' : `<form id="ai-revision" class="ai-composer"><label class="visually-hidden" for="ai-revision-text">${hasPlan ? "What would you like to change?" : "Message Buffy"}</label><textarea id="ai-revision-text" name="message" maxlength="2000" rows="2" required placeholder="Message Buffy…" ${busy || saving ? "disabled" : ""}>${esc(revisionText)}</textarea><div class="ai-composer-tools"><details class="ai-chat-options"><summary>Privacy${!draft ? " & starting weights" : ""}</summary>${!draft ? `<label class="ai-history-choice"><input name="useHistory" type="checkbox" ${useHistory ? "checked" : ""} ${busy ? "disabled" : ""}><span>Use my recent completed weights</span></label>` : ""}<p class="ai-data-note">Your messages and library exercise names are sent to Claude. Recent set history is shared only if you opt in when starting the conversation. Review your program before saving.</p></details><button class="button primary" type="submit" ${busy || saving || !status?.enabled ? "disabled" : ""}>${busy ? "Thinking…" : "Send message"}</button></div></form>`}</section>`;
  }
  function render() {
    if (destroyed) return;
    let content;
    if (loading)
      content =
        '<p class="ai-popup-loading" role="status">Connecting to Buffy…</p>';
    else
      content = `${error ? `<p class="ai-error" role="alert">${esc(error)}${requestError ? ' <button class="text-button" data-action="reload">Try again</button>' : ""}</p>` : ""}${status && !status.enabled ? '<p class="ai-capacity" role="status">AI program creation is not enabled yet. You can still build programs manually.</p>' : ""}${chat()}`;
    app.innerHTML = `<div class="ai-main">${content}</div>`;
    const transcript = app.querySelector(".ai-messages");
    if (transcript) transcript.scrollTop = transcript.scrollHeight;
  }
  app.addEventListener("input", (event) => {
    if (event.target.id === "ai-revision-text")
      revisionText = event.target.value;
  });
  app.addEventListener("change", (event) => {
    if (event.target.name === "useHistory") useHistory = event.target.checked;
  });
  app.addEventListener("keydown", (event) => {
    if (
      event.target.id === "ai-revision-text" &&
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.isComposing &&
      !busy &&
      !saving
    ) {
      event.preventDefault();
      event.target.form.requestSubmit();
    }
  });
  app.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy || saving || destroyed || !event.target.reportValidity()) return;
    const message = event.target.elements.message.value;
    pendingMessage = message;
    revisionText = "";
    const owner = cloud.account()?.id;
    busy = true;
    error = "";
    requestError = false;
    render();
    try {
      const result = await api("/generate", {
        method: "POST",
        body: JSON.stringify(
          draft
            ? { id: draft.id, version: draft.version, message }
            : { message, today: today(), useHistory },
        ),
      });
      if (destroyed || cloud.account()?.id !== owner) return;
      draft = result;
      draftOwner = owner;
      revisionText = "";
      try {
        status = await api();
      } catch {}
    } catch (e) {
      if (!destroyed && cloud.account()?.id === owner) {
        revisionText = message;
        error = e.message;
        if (e.status === 409) requestError = true;
        try {
          status = await api();
        } catch {}
      }
    } finally {
      pendingMessage = "";
      busy = false;
      render();
    }
  });
  app.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    if (action === "return-programs") {
      if (busy || saving) return;
      try {
        await beforeSave();
        await cloud.flush();
        await onSaved(draft.savedProgramId);
        if (!destroyed) onClose();
      } catch (e) {
        error = e.message;
        render();
      }
      return;
    }
    if (busy || saving || destroyed) return;
    if (action === "reload") {
      error = "";
      requestError = false;
      return load();
    }
    if (action === "starter") {
      revisionText = button.dataset.message;
      render();
      app.querySelector("#ai-revision-text")?.focus();
      return;
    }
    if (action === "start-over") {
      if (
        !confirm(
          "Start a new program? Your current draft remains in Recent drafts.",
        )
      )
        return;
      draft = null;
      revisionText = "";
      useHistory = false;
      error = "";
      return render();
    }
    if (action === "resume") {
      try {
        const owner = cloud.account()?.id;
        const result = await api("/" + button.dataset.id);
        if (destroyed || cloud.account()?.id !== owner) return;
        draft = result;
        draftOwner = owner;
        error = "";
        render();
      } catch (e) {
        error = e.message;
        render();
      }
      return;
    }
    if (action === "save" && draft?.plan) {
      saving = true;
      error = "";
      render();
      try {
        if (draftOwner !== cloud.account()?.id)
          throw Error("Sign in again before saving.");
        await beforeSave();
        await cloud.flush();
        if (destroyed || draftOwner !== cloud.account()?.id) return;
        const result = await api("/" + draft.id + "/save", {
          method: "POST",
          body: JSON.stringify({ version: draft.version }),
        });
        if (destroyed || draftOwner !== cloud.account()?.id) return;
        await onSaved(result.programId);
        if (destroyed) return;
        draft.savedProgramId = result.programId;
        saving = false;
        render();
      } catch (e) {
        error = e.message;
        saving = false;
        render();
      }
    }
  });
  const beforeUnload = (event) => {
    if (busy || saving) {
      event.preventDefault();
      event.returnValue = "";
    }
  };
  window.addEventListener("beforeunload", beforeUnload);
  void load();
  return {
    focus: () => {
      const transcript = app.querySelector(".ai-messages");
      if (transcript) transcript.scrollTop = transcript.scrollHeight;
      app
        .querySelector(
          "#ai-revision-text, .ai-composer [data-action=return-programs]",
        )
        ?.focus({ preventScroll: true });
    },
    destroy: () => {
      destroyed = true;
      requests.abort();
      window.removeEventListener("beforeunload", beforeUnload);
      app.replaceChildren();
    },
  };
}
