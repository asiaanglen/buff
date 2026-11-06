import { createCloud } from "./cloud.js";
import { brandLogo } from "./brand.js";
import { shiftDate } from "../shared/programs.js";
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/manrope";
import "./style.css";
import "./themes.css";
import "./coach.css";
import "./ai-programs.css";
const app = document.querySelector("#app");
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
const fmt = (value) =>
  new Date(value + "T12:00:00").toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
const coachMode = new URL(location.href).searchParams.get("coach") === "1";
const back = coachMode ? "/coach?tab=programs" : "/?tab=programs";
let state = { version: 1, unit: "lbs", programs: [], workouts: [] },
  loading = true,
  busy = false,
  saving = false,
  status = null,
  draft = null,
  error = "",
  requestError = false;
let draftOwner = null;
let formDraft = {
  goal: "Build strength",
  experience: "beginner",
  equipment: "Full gym",
  daysPerWeek: 3,
  minutes: 45,
  weeks: 4,
  startDate: today(),
  preferences: "",
  useHistory: false,
};
let revisionText = "";
async function api(path = "", options = {}) {
  const response = await fetch("/api/ai-programs" + path, {
    credentials: "same-origin",
    cache: "no-store",
    signal: AbortSignal.timeout(95000),
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
const cloud = createCloud({
  getState: () => state,
  setState: (next) => {
    state = next;
  },
  canApply: () => !busy && !saving,
  onThemeChange: (theme) => {
    state.theme = theme;
    cloud.save();
    render();
  },
  preservePath: true,
  onAuthenticated: async () => {
    await load();
    return true;
  },
  onStatus: () => {
    if (!cloud.isSignedIn() && !loading) {
      draft = null;
      status = null;
      revisionText = "";
      error = "";
      draftOwner = null;
      render();
    }
  },
});
async function load() {
  loading = true;
  render();
  try {
    if (cloud.isSignedIn()) {
      const owner = cloud.account()?.id;
      const result = await api();
      if (cloud.account()?.id === owner) {
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
function captureForm() {
  const form = app.querySelector("#ai-brief");
  if (!form) return;
  const values = Object.fromEntries(new FormData(form));
  formDraft = {
    ...values,
    daysPerWeek: Number(values.daysPerWeek),
    minutes: Number(values.minutes),
    weeks: Number(values.weeks),
    useHistory: form.elements.useHistory.checked,
  };
}
function briefForm() {
  return `<form id="ai-brief" class="ai-panel"><h2>Tell your coach what you need</h2><p>One short form, then chat to refine your program.</p><div class="form-grid"><label>Your goal<input name="goal" required maxlength="300" value="${esc(formDraft.goal)}" placeholder="e.g. Build strength and muscle"></label><label>Training experience<select name="experience">${["beginner", "intermediate", "advanced"].map((v) => `<option value="${v}" ${formDraft.experience === v ? "selected" : ""}>${v[0].toUpperCase() + v.slice(1)}</option>`).join("")}</select></label><label>Available equipment<input name="equipment" required maxlength="400" value="${esc(formDraft.equipment)}" placeholder="e.g. Dumbbells, bench, bands"></label><label>Training days per week<select name="daysPerWeek">${Array.from({ length: 7 }, (_, i) => `<option value="${i + 1}" ${formDraft.daysPerWeek === i + 1 ? "selected" : ""}>${i + 1}</option>`).join("")}</select></label><label>Minutes per workout<input name="minutes" type="number" required min="10" max="180" value="${formDraft.minutes}"></label><label>Program length (weeks)<input name="weeks" type="number" required min="1" max="52" value="${formDraft.weeks}"></label><label>Week 1 start date<input name="startDate" type="date" required value="${esc(formDraft.startDate)}"></label></div><label>Preferences or movements to avoid <span class="optional">optional</span><textarea name="preferences" rows="3" maxlength="1000" placeholder="Exercises you like, movements to avoid, preferred training days…">${esc(formDraft.preferences)}</textarea></label><label class="ai-history-choice"><input name="useHistory" type="checkbox" ${formDraft.useHistory ? "checked" : ""}><span>Use my recent completed weights to suggest starting loads</span></label><p class="ai-data-note">Your form, library exercise names, and revision messages are sent to Claude. Recent set history is shared only if you select the option above. Otherwise, starting weights are left unassigned. Review the draft before saving.</p><button class="button primary" type="submit" ${!status?.enabled || busy ? "disabled" : ""}>${busy ? "Building your program…" : "Build my program"}</button></form>`;
}
function preview() {
  const plan = draft.plan;
  const byWeek = Array.from({ length: plan.program.weeks }, (_, i) => ({
    number: i + 1,
    workouts: plan.workouts.filter((w) => Math.floor(w.offset / 7) === i),
  }));
  return `<section class="ai-panel ai-preview"><span class="tag">DRAFT · NOT SAVED</span><h2>${esc(plan.program.name)}</h2><a class="text-button" href="#ai-revision-text">Ask for changes ↓</a><p>${esc(plan.program.note)}</p><p><strong>${plan.program.weeks} weeks · ${plan.workouts.length} workouts</strong> · Starts ${fmt(draft.startDate)}</p>${byWeek.map((week) => `<details class="ai-week" ${week.number === 1 ? "open" : ""}><summary>Week ${week.number}<span>${week.workouts.length} workouts</span></summary>${week.workouts.map((w) => `<article class="ai-workout"><div><h3>${esc(w.name)}</h3><span>${fmt(shiftDate(draft.startDate, w.offset))}</span></div>${w.note ? `<p class="ai-week-note">${esc(w.note)}</p>` : ""}<ol>${w.exercises.map((e) => `<li><strong>${esc(e.name)}</strong><span>${e.sets} sets × ${e.target} ${e.mode === "time" ? "sec" : "reps"} · ${e.weight ? e.weight + " lbs suggested" : e.weighted === false ? "Bodyweight" : "Starting weight unassigned"}${e.group ? " · Superset " + esc(e.group) : ""}</span></li>`).join("")}</ol></article>`).join("")}</details>`).join("")}<div class="ai-save"><p>Saving adds a new program to your library. Enrollment and your current program stay unchanged.</p><button type="button" class="button primary" data-action="save" ${busy || saving ? "disabled" : ""}>${saving ? "Saving…" : "Save program"}</button><button type="button" class="text-button" data-action="start-over" ${busy || saving ? "disabled" : ""}>Create a different program</button></div></section>`;
}
function chat() {
  return `<section class="ai-panel ai-chat"><h2>Refine your program</h2><p>Ask for changes before saving—for example, “Make the workouts 30 minutes” or “Swap Wednesday’s lunges for step-ups.”</p><div class="ai-messages" aria-label="Program revision conversation">${draft.conversation.map((m) => `<article class="ai-message ${m.role === "user" ? "ai-message-user" : ""}"><strong>${m.role === "user" ? "You" : "Your Buff coach"}</strong><p>${esc(m.text)}</p></article>`).join("")}</div><form id="ai-revision"><label for="ai-revision-text">What would you like to change?</label><textarea id="ai-revision-text" name="message" maxlength="2000" rows="3" required placeholder="Tell your coach how to adjust the draft…" ${busy || saving ? "disabled" : ""}>${esc(revisionText)}</textarea><button class="button primary" type="submit" ${busy || saving || !status?.enabled ? "disabled" : ""}>${busy ? "Updating your draft…" : "Revise program"}</button></form></section>`;
}
function render() {
  document.documentElement.dataset.theme =
    cloud.isSignedIn() && state.theme === "muscle-mami"
      ? "muscle-mami"
      : "classic";
  const top = `<header class="ai-top"><a class="brand" href="${back}" aria-label="Buff programs">${brandLogo()}</a><div><a href="${back}">← Programs</a>${cloud.isSignedIn() ? '<button type="button" class="button subtle" data-action="account">Account</button>' : ""}</div></header>`;
  let content;
  if (loading)
    content =
      '<section class="ai-panel" role="status">Loading your program creator…</section>';
  else if (!cloud.isSignedIn())
    content =
      '<section class="ai-panel"><h1>Create your next program</h1><p>Sign in to build a program with Claude, refine it, and save it to your Buff account.</p><div class="coach-actions"><button class="button primary" data-action="signup">Create account</button><button class="button subtle" data-action="signin">Sign in</button></div></section>';
  else
    content = `<div class="ai-heading"><span class="eyebrow">YOUR PROGRAM, BUILT WITH YOU</span><h1>Create with AI</h1><p>${coachMode ? "Create a program template, refine it with your AI coach, then share it with clients." : "Tell us your goals. Build a draft. Make it yours."}</p></div>${error ? `<p class="ai-error" role="alert">${esc(error)}${requestError ? ' <button class="text-button" data-action="reload">Try again</button>' : ""}</p>` : ""}${status && !status.enabled ? '<p class="ai-capacity" role="status">AI program creation is not enabled yet. You can still create programs manually. Your account does not need a Claude subscription.</p>' : ""}${busy ? '<p class="ai-working" role="status"><span class="boot-spinner" aria-hidden="true"></span>Your coach is working on the full program. This can take a minute; keep this page open.</p>' : ""}${draft ? `<div class="ai-draft-layout">${preview()}${chat()}</div>` : briefForm()}${!draft && status?.drafts?.length ? `<section class="ai-panel"><h2>Recent drafts</h2><p>Drafts are private and available for 30 days.</p>${status.drafts.map((d) => `<button class="button subtle ai-resume" data-action="resume" data-id="${d.id}">${esc(d.name)}${d.saved_program_id ? " · Saved" : " · Resume draft"}</button>`).join("")}</section>` : ""}`;
  app.innerHTML = `<div class="ai-shell">${top}<main class="ai-main">${content}</main></div>`;
  if (busy || saving)
    app
      .querySelectorAll("#ai-brief input, #ai-brief select, #ai-brief textarea")
      .forEach((input) => {
        input.disabled = true;
      });
}
app.addEventListener("input", (event) => {
  if (event.target.closest("#ai-brief")) captureForm();
  if (event.target.id === "ai-revision-text") revisionText = event.target.value;
});
app.addEventListener("change", (event) => {
  if (event.target.closest("#ai-brief")) captureForm();
});
app.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy || saving || !event.target.reportValidity()) return;
  const isRevision = event.target.id === "ai-revision";
  if (!isRevision) captureForm();
  else revisionText = event.target.elements.message.value;
  const owner = cloud.account()?.id;
  busy = true;
  error = "";
  requestError = false;
  render();
  try {
    const result = await api("/generate", {
      method: "POST",
      body: JSON.stringify(
        isRevision
          ? { id: draft.id, version: draft.version, message: revisionText }
          : { brief: formDraft },
      ),
    });
    if (cloud.account()?.id !== owner) return;
    draft = result;
    draftOwner = owner;
    revisionText = "";
    try {
      status = await api();
    } catch {}
  } catch (e) {
    if (cloud.account()?.id === owner) {
      error = e.message;
      if (e.status === 409) requestError = true;
      try {
        status = await api();
      } catch {}
    }
  } finally {
    busy = false;
    render();
  }
});
app.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  if (action === "account") return cloud.open();
  if (action === "signin" || action === "signup") return cloud.open(action);
  if (busy || saving) return;
  if (action === "reload") {
    error = "";
    requestError = false;
    return load();
  }
  if (action === "start-over") {
    if (
      !confirm(
        "Start a new program? Your current draft remains in Recent drafts.",
      )
    )
      return;
    draft = null;
    error = "";
    return render();
  }
  if (action === "resume") {
    try {
      const owner = cloud.account()?.id;
      const result = await api("/" + button.dataset.id);
      if (cloud.account()?.id !== owner) return;
      draft = result;
      draftOwner = owner;
      if (draft.savedProgramId) {
        location.assign(back);
        return;
      }
      error = "";
      render();
    } catch (e) {
      error = e.message;
      render();
    }
    return;
  }
  if (action === "save" && draft) {
    saving = true;
    error = "";
    render();
    try {
      if (draftOwner !== cloud.account()?.id)
        throw Error("Sign in again before saving.");
      await cloud.flush();
      await api("/" + draft.id + "/save", {
        method: "POST",
        body: JSON.stringify({ version: draft.version }),
      });
      await cloud.refresh();
      saving = false;
      location.assign(back);
    } catch (e) {
      error = e.message;
      saving = false;
      render();
    }
  }
});
window.addEventListener("beforeunload", (event) => {
  if (busy || saving) {
    event.preventDefault();
    event.returnValue = "";
  }
});
window.addEventListener("pageshow", (event) => {
  if (event.persisted) location.reload();
});
render();
const started = await cloud.start();
if (started.ok) await load();
else {
  loading = false;
  error = "Could not connect to Buff. Reload to try again.";
  render();
}
