import { editClientWorkout } from "./coach-editor.js";
import { createCloud } from "./cloud.js";
import { smsLink } from "./sharing.js";
import { programWeek } from "../shared/programs.js";
import { programProgress, personName } from "../shared/coaching.js";
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/manrope";
import "./style.css";
import "./themes.css";
import "./coach.css";
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
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const date = (value) =>
  new Date(value + "T12:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
const dateTime = (value) => new Date(value).toLocaleString();
const accessView = new URL(location.href).searchParams.get("view") === "access";
const INVITE_KEY = "buff-coaching-invite",
  DRAFT_KEY = "buff-coaching-consent";
let token = null;
const incoming = new URLSearchParams(location.hash.slice(1)).get("invite");
try {
  if (incoming && /^[a-f0-9]{64}$/.test(incoming)) {
    token = incoming;
    sessionStorage.setItem(
      INVITE_KEY,
      JSON.stringify({ token, created: Date.now() }),
    );
    history.replaceState(null, "", location.pathname + location.search);
  } else if (!accessView) {
    const saved = JSON.parse(sessionStorage.getItem(INVITE_KEY));
    if (
      saved?.token &&
      /^[a-f0-9]{64}$/.test(saved.token) &&
      Date.now() - saved.created < 30 * 86400000
    )
      token = saved.token;
  }
} catch {}
let state = { version: 1, unit: "lbs", programs: [], workouts: [] },
  data = null,
  connections = [],
  selected = null,
  inviteInfo = null,
  shareResult = null,
  loading = true,
  error = "",
  notice = "",
  page = "clients",
  dirty = false,
  openWorkout = null;
async function api(path = "", options = {}) {
  const r = await fetch("/api/coaching" + path, {
    credentials: "same-origin",
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const value = await r.json();
  if (!r.ok)
    throw Object.assign(
      Error(value.error || "Could not complete this request."),
      { status: r.status },
    );
  return value;
}
function clearInvite() {
  token = null;
  inviteInfo = null;
  try {
    sessionStorage.removeItem(INVITE_KEY);
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {}
}
function consentDraft() {
  try {
    const v = JSON.parse(sessionStorage.getItem(DRAFT_KEY));
    return v?.token === token &&
      v.consent === true &&
      Date.now() - v.created < 30 * 60000
      ? v
      : null;
  } catch {
    return null;
  }
}
async function join() {
  const draft = consentDraft();
  if (!draft)
    throw Error("Review and accept the coaching permission before joining.");
  const account = cloud.account();
  if (draft.userId && draft.userId !== account?.id)
    throw Error("Your account changed. Review the invitation again.");
  await cloud.flush();
  await api("/invites/" + token + "/accept", {
    method: "POST",
    body: JSON.stringify({
      startDate: draft.startDate,
      allowCoachLogging: true,
    }),
  });
  await cloud.refresh();
  clearInvite();
  location.assign("/?tab=programs&coach_joined=1");
}
async function load() {
  error = "";
  loading = true;
  render();
  try {
    if (token) inviteInfo = await api("/invites/" + token);
    if (cloud.isSignedIn()) {
      if (token && consentDraft()) return await join();
      if (accessView) connections = (await api("/access")).assignments;
      else if (!token) data = await api();
    }
  } catch (e) {
    error = e.message;
  }
  loading = false;
  render();
}
const cloud = createCloud({
  preservePath: true,
  authContext: token || accessView ? "" : "coach",
  getState: () => state,
  setState: (next) => {
    state = next;
    render();
  },
  canApply: () => !selected && !shareResult,
  onThemeChange: (theme) => {
    state.theme = theme;
    cloud.save();
    render();
  },
  onStatus: (label) => {
    const el = app.querySelector("#sync-label");
    if (el) el.textContent = label;
    if (!cloud.isSignedIn() && !loading) {
      data = null;
      selected = null;
      connections = [];
      shareResult = null;
      dirty = false;
      render();
    }
  },
  onAuthenticated: async () => {
    if (token && consentDraft()) {
      await join();
      return true;
    }
    if (!token && !accessView)
      await api("/profile", { method: "POST", body: "{}" });
    await load();
    return true;
  },
});
function header() {
  return `<header class="coach-top"><a class="brand" href="/coach">b. <span>buff.</span><small>FOR COACHES</small></a><div class="coach-top-actions"><a href="/">My Buff</a>${cloud.isSignedIn() ? '<button type="button" class="button subtle" data-cmd="account">Account</button>' : ""}</div></header>`;
}
function empty(title, text, action = "") {
  return `<section class="coach-empty"><h2>${title}</h2><p>${text}</p>${action}</section>`;
}
function invitation() {
  if (!inviteInfo)
    return empty(
      "Coaching invitation",
      esc(error || "Loading invitation…"),
      '<a class="button subtle" href="/">Back to Buff</a><button class="text-button" data-cmd="dismiss-invite">Dismiss invitation</button>',
    );
  return `<section class="coach-hero"><span class="eyebrow">YOUR NEXT PROGRAM, WITH SUPPORT</span><h1>${esc(inviteInfo.coachName)} invited you to train.</h1><p>Join Buff to add this program to your library and work with your coach.</p></section><section class="coach-panel coach-invite"><span class="tag">${inviteInfo.weeks} WEEKS · ${inviteInfo.workoutCount} WORKOUTS</span><h2>${esc(inviteInfo.programName)}</h2><form id="coach-join-form"><label>Week 1 start date<input type="date" name="startDate" required value="${consentDraft()?.startDate || today()}"></label><label class="coach-consent"><input type="checkbox" name="consent" required><span>I allow <strong>${esc(inviteInfo.coachName)}</strong> to see my name, email, and progress for this program, reschedule my workouts, edit exercises and targets, and enter or update my workout results and exercise notes for me.</span></label><p>You can end this access on the <a href="/coach?view=access">coaching access page</a>. Your other programs, personal details, and workouts stay private. This adds a program to your library; starting it remains your choice.</p>${inviteInfo.emailRestricted ? "<p>Use the email address your coach invited.</p>" : ""}${cloud.isSignedIn() ? `<p>Joining as <strong>${esc(cloud.account()?.email)}</strong></p><button class="button primary" type="submit">Accept invitation & add program →</button>` : '<div class="coach-actions"><button class="button primary" name="auth" value="signup" type="submit">Create account & join</button><button class="button subtle" name="auth" value="signin" type="submit">Sign in & join</button></div>'}</form><button class="text-button" data-cmd="dismiss-invite">Dismiss invitation</button></section>`;
}
function access() {
  return `<div class="coach-heading"><div><span class="eyebrow">YOU CONTROL YOUR CONNECTIONS</span><h1>Your coaching access</h1><p>Ending access stops future coach viewing and updates. Your programs and recorded results stay in your account.</p></div></div><div class="coach-grid">${connections.map((a) => `<article class="coach-panel"><h2>${esc(a.program_name)}</h2><p>Coach: ${esc(a.coach_name)}</p><p>${a.revoked ? "Access ended" : "Coach can view and edit this program’s workouts, exercises, and results."}</p>${!a.revoked ? `<button class="button subtle" data-cmd="revoke-access" data-id="${a.id}">End coach access</button>` : ""}</article>`).join("") || empty("No coaching connections yet.", "Accept an invitation from a coach to get started.")}</div>`;
}
function clientCards() {
  const groups = new Map();
  for (const a of data.assignments) {
    const key = a.client_email;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(a);
  }
  return (
    [...groups.values()]
      .map(
        (group) =>
          `<section class="coach-client"><h2>${esc(group[0].client_name)}</h2><p>${esc(group[0].client_email)}</p><div class="coach-grid">${group
            .map((a) => {
              const active = !a.revoked && a.program_exists;
              const pct = a.sets ? Math.round((a.sets_done / a.sets) * 100) : 0;
              return `<article class="coach-panel"><h3>${esc(a.program_name)}</h3><p>${a.revoked ? "Access ended" : !a.program_exists ? "Client removed this program" : `${a.completed} of ${a.workouts} workouts completed · ${a.sets_done} of ${a.sets} sets`}</p>${active ? `<progress value="${pct}" max="100" aria-label="${esc(a.program_name)} progress">${pct}%</progress><button class="button primary" data-cmd="open-client" data-id="${a.id}">View progress & log workouts →</button><button class="text-button danger" data-cmd="end-assignment" data-id="${a.id}">End coaching access</button>` : ""}</article>`;
            })
            .join("")}</div></section>`,
      )
      .join("") ||
    empty(
      "Your clients will appear here.",
      "Create a program, then invite your first client. Their program and progress appear here after they accept.",
      '<button class="button primary" data-cmd="programs">Choose a program →</button>',
    )
  );
}
function programs() {
  return `<a class="ai-program-callout" href="/connections#ai-program-guide"><span class="ai-callout-icon" aria-hidden="true">✧</span><span><strong>Learn how to create programs with AI here</strong><small>Connect ChatGPT or Claude to create your program templates.</small></span><span aria-hidden="true">↗</span></a><p class="coach-help">Build programs using Buff’s exercise library, weeks, sets, targets, and supersets. Clients get their own copy. Changes to your template do not overwrite a client’s existing plan or results.</p><a class="button primary" href="/?coach=1">Build or edit programs →</a><div class="coach-grid">${(state.programs || []).map((p) => `<article class="coach-panel"><span class="tag">${p.weeks} WEEKS</span><h2>${esc(p.name)}</h2><p>${state.workouts.filter((w) => w.programId === p.id).length} workouts</p><button class="button subtle" data-cmd="invite" data-id="${esc(p.id)}">Invite a client →</button></article>`).join("") || empty("Create your first program.", "Your programs are saved to your own account.", '<a class="button subtle" href="/?coach=1">Open program builder</a>')}</div>`;
}
function pending() {
  return `<section class="coach-pending"><h2>Pending invitations</h2><p>Links expire after 30 days and can be accepted by one client. Create a new invitation for each client.</p>${data.invitations.map((i) => `<article class="coach-panel"><div><strong>${esc(i.programName)}</strong><p>${esc(i.client_email || "Text invitation · any recipient with the link")} · Expires ${dateTime(i.expires)}</p></div><button class="button subtle" data-cmd="revoke-invite" data-id="${i.id}">Disable invitation</button></article>`).join("") || "<p>No pending invitations.</p>"}</section>`;
}
function logForm(w) {
  const progress = programProgress([w]);
  return `<details class="coach-workout" name="client-workout" ${openWorkout === w.id ? "open" : ""}><summary><span><strong>Week ${programWeek(selected.program, w.date)} · ${esc(w.name)}</strong><small>${esc(date(w.date))}</small></span><span>${progress.completed ? "Completed ✓" : `${progress.setsDone}/${progress.sets} sets`}</span></summary><div class="coach-actions"><button type="button" class="button subtle" data-cmd="edit-client-workout" data-id="${esc(w.id)}">Move / edit workout</button></div><form class="coach-log" data-workout="${esc(w.id)}">${w.exercises.map((e, index) => `<fieldset data-exercise="${esc(e.id)}"><legend>${index + 1}. ${esc(e.name)}${e.group ? ` · Superset ${esc(e.group)}` : ""}</legend><p>Target: ${e.sets} × ${e.target} ${e.mode === "time" ? "seconds" : "reps"}${e.weight ? ` at ${e.weight} lbs` : ""}</p><div class="coach-set-head"><span>Set</span><span>Lbs</span><span>${e.mode === "time" ? "Seconds" : "Reps"}</span><span>Done</span></div>${e.logs.map((l, i) => `<div class="coach-set" data-log><span>${i + 1}</span><input type="number" min="0" max="5000" step="0.01" data-weight aria-label="${esc(e.name)} set ${i + 1} weight" value="${esc(l.weight)}" placeholder="${e.weight}"><input type="number" min="0" max="10000" step="0.01" data-actual aria-label="${esc(e.name)} set ${i + 1} ${e.mode === "time" ? "seconds" : "reps"}" value="${esc(l.actual)}" placeholder="${e.target}"><input type="checkbox" data-done aria-label="${esc(e.name)} set ${i + 1} completed" ${l.done ? "checked" : ""}></div>`).join("")}<label for="coach-note-${esc(e.id)}">Notes for ${esc(e.name)}</label><textarea id="coach-note-${esc(e.id)}" data-note maxlength="1000" rows="2">${esc(e.note || "")}</textarea></fieldset>`).join("")}<p class="form-error" role="alert"></p><div class="coach-actions"><button type="submit" class="button primary">Save workout progress</button><button type="submit" class="button subtle" data-complete="true">Mark workout complete</button></div><p>Changes save to ${esc(selected.clientName)}’s program and appear in their exercise history. Marking complete fills blank results with the planned targets.</p></form></details>`;
}
function detail() {
  return `<div class="coach-heading"><div><button class="text-button" data-cmd="back">← All clients</button><span class="eyebrow">CLIENT PROGRAM</span><h1>${esc(selected.clientName)}</h1><h2>${esc(selected.program.name)}</h2><p>${selected.progress.completed}/${selected.progress.workouts} workouts completed · ${selected.progress.setsDone}/${selected.progress.sets} sets logged</p><p>Connection updated: ${dateTime(selected.updated)}</p></div><button class="button subtle" data-cmd="refresh-client">Refresh client progress</button></div><p class="coach-help">You can reschedule workouts, edit exercises, and log results for this accepted program. Use Move / edit workout to change dates, swap or reorder exercises, and adjust sets, targets, or supersets. Save each workout before moving to another. If the client makes changes, refresh their progress before saving.</p>${
    [...selected.workouts]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(logForm)
      .join("") ||
    empty(
      "No workouts remain in this program.",
      "The client may have removed or rescheduled their workouts.",
    )
  }`;
}
function render() {
  document.title = token
    ? "Buff — Coaching invitation"
    : accessView
      ? "Buff — Coaching access"
      : "Buff for coaches";
  document.documentElement.dataset.theme =
    cloud.isSignedIn() && state.theme === "muscle-mami"
      ? "muscle-mami"
      : "classic";
  let content;
  if (loading)
    content = empty("Loading Buff…", "Getting your coaching workspace ready.");
  else if (token) content = invitation();
  else if (!cloud.isSignedIn())
    content = `<section class="coach-hero"><span class="eyebrow">A LITTLE STRONGER, TOGETHER</span><h1>${accessView ? "Your programs. Your coach. Your choice." : "Your clients. Their progress. One place."}</h1><p>${accessView ? "Sign in to manage which coaches can view and update your programs." : "Build programs, invite clients, follow their progress, and log workouts together."}</p><div class="coach-actions"><button class="button primary" data-cmd="signup">${accessView ? "Create an account" : "Create a coach account"}</button><button class="button subtle" data-cmd="signin">${accessView ? "Sign in" : "Coach sign in"}</button></div></section><div class="coach-grid"><article class="coach-panel"><h2>Build a plan that fits.</h2><p>Programs of any length, your exercise library, supersets, and targets in pounds.</p></article><article class="coach-panel"><h2>Invite your clients.</h2><p>Share a personal link by email or text. They join Buff and get the program in their library.</p></article><article class="coach-panel"><h2>Coach with context.</h2><p>See completed workouts and logged sets. Enter reps, weight, time, and notes for an accepted client program.</p></article></div>`;
  else if (accessView) content = access();
  else if (!data?.isCoach)
    content = empty(
      "Create your coach profile",
      "Use your existing Buff login. Your personal programs stay in your account, and client access starts only when they accept an invitation.",
      '<button class="button primary" data-cmd="enable">Create coach profile</button>',
    );
  else if (selected) content = detail();
  else
    content = `<div class="coach-heading"><div><span class="eyebrow">BUFF FOR COACHES</span><h1>Welcome, ${esc(cloud.profile().firstName || "coach")}.</h1><p>${page === "programs" ? "Create and manage your programs, then share them with clients." : "Monitor your clients’ progress and manage their assigned workouts."}</p></div><button class="button subtle" data-cmd="refresh">Refresh progress</button></div><nav class="coach-tabs" aria-label="Coach workspace"><button class="button ${page === "clients" ? "primary" : "subtle"}" data-cmd="clients">Clients</button><button class="button ${page === "programs" ? "primary" : "subtle"}" data-cmd="programs">Programs</button></nav>${page === "programs" ? programs() + pending() : clientCards()}`;
  app.innerHTML = `<div class="coach-shell">${header()}<main class="coach-main">${error ? `<p class="coach-error" role="alert">${esc(error)}</p>` : ""}${notice ? `<p class="coach-notice" role="status">${esc(notice)}</p>` : ""}${content}</main><footer class="coach-footer"><a href="/">Back to Buff</a><a href="/feedback">Give feedback / Report a bug</a><span id="sync-label">${esc(cloud.label())}</span></footer></div>`;
}
async function invite(id) {
  await cloud.flush();
  const p = state.programs?.find((p) => p.id === id);
  if (!p) throw Error("Program not found.");
  document.querySelector("#coach-invite-dialog")?.remove();
  const dialog = document.createElement("dialog");
  dialog.id = "coach-invite-dialog";
  dialog.className = "exercise-guide-dialog";
  dialog.innerHTML = `<div class="modal-header"><h2>Invite a client</h2><button class="icon-button" type="button" aria-label="Close invitation">×</button></div><p>${esc(p.name)} · Each client receives their own copy and chooses whether to grant coaching access.</p><form><p>Create a private invitation link, then copy it into an email or share it by text. Each link can be accepted by one client.</p><p class="form-error" role="alert"></p><button class="button primary" type="submit">Create invitation</button></form><section class="coach-share-result" hidden></section>`;
  dialog.querySelector('[aria-label="Close invitation"]').onclick = () =>
    dialog.close();
  dialog.addEventListener(
    "close",
    () => {
      shareResult = null;
      dialog.remove();
      render();
    },
    { once: true },
  );
  document.body.append(dialog);
  dialog.showModal();
  dialog.querySelector("form").onsubmit = async (event) => {
    event.preventDefault();
    const button = event.submitter;
    button.disabled = true;
    try {
      const result = await api("/invites", {
        method: "POST",
        body: JSON.stringify({
          programId: id,
        }),
      });
      shareResult = result;
      const message = `${result.coachName} invited you to train with them on Buff! Join ${result.programName} here:\n${result.url}\nAccept the invitation to add the program and share your progress with your coach.`;
      const output = dialog.querySelector(".coach-share-result");
      output.hidden = false;
      output.innerHTML = `<h3>Your client’s invitation is ready</h3><label for="coach-invitation-message">Invitation message</label><textarea id="coach-invitation-message" readonly rows="6">${esc(message)}</textarea><div class="coach-actions"><button type="button" class="button primary" data-copy>Copy invitation</button><a class="button subtle" href="${smsLink(message)}">Share by text</a>${navigator.share ? '<button type="button" class="button subtle" data-native>Share…</button>' : ""}</div><p class="coach-copy-status" role="status"></p><p>To invite by email, copy the invitation above and paste it into an email to your client. Share by text opens Messages with the invitation filled in; choose a contact and send it. Each link is for one client and expires after 30 days.</p>`;
      output.querySelector("[data-copy]").onclick = async () => {
        try {
          await navigator.clipboard.writeText(message);
          output.querySelector(".coach-copy-status").textContent =
            "Invitation copied. Paste it into an email to your client.";
        } catch {
          output.querySelector("textarea").select();
          output.querySelector(".coach-copy-status").textContent =
            "Select and copy the invitation above.";
        }
      };
      const native = output.querySelector("[data-native]");
      if (native)
        native.onclick = async () => {
          try {
            await navigator.share({ title: result.programName, text: message });
          } catch (e) {
            if (e.name !== "AbortError")
              output.querySelector(".coach-copy-status").textContent =
                "Use email, text, or copy the invitation above.";
          }
        };
      dialog.querySelector("form").hidden = true;
      data = await api();
    } catch (e) {
      dialog.querySelector(".form-error").textContent = e.message;
      button.disabled = false;
    }
  };
}
app.addEventListener("input", (event) => {
  if (event.target.closest(".coach-log")) dirty = true;
});
app.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-cmd]");
  if (!button) return;
  const cmd = button.dataset.cmd;
  error = "";
  notice = "";
  try {
    if (cmd === "account") return cloud.open();
    if (cmd === "signin" || cmd === "signup") return cloud.open(cmd);
    if (cmd === "dismiss-invite") {
      clearInvite();
      return load();
    }
    if (cmd === "enable") {
      await api("/profile", { method: "POST", body: "{}" });
      return load();
    }
    if (cmd === "clients" || cmd === "programs") {
      page = cmd;
      return render();
    }
    if (cmd === "invite") return await invite(button.dataset.id);
    if (cmd === "edit-client-workout") {
      if (dirty) {
        alert("Save your workout progress before editing the plan.");
        return;
      }
      const w = selected.workouts.find((w) => w.id === button.dataset.id);
      const result = await editClientWorkout(
        w,
        selected.program,
        state.customExercises || [],
        (input) =>
          api(
            "/assignments/" +
              selected.id +
              "/workouts/" +
              encodeURIComponent(w.id),
            {
              method: "PATCH",
              body: JSON.stringify({ ...input, revision: selected.revision }),
            },
          ),
      );
      if (result) {
        selected = { ...selected, ...result };
        openWorkout = w.id;
        notice = "Workout plan updated for " + selected.clientName + ".";
        render();
      }
      return;
    }

    if (cmd === "refresh") {
      await cloud.refresh();
      return load();
    }
    if (cmd === "back") {
      if (dirty && !confirm("Leave these unsaved workout changes?")) return;
      selected = null;
      dirty = false;
      return load();
    }
    if (cmd === "open-client" || cmd === "refresh-client") {
      if (
        dirty &&
        !confirm("Discard unsaved entries and refresh the client’s progress?")
      )
        return;
      selected = await api(
        "/assignments/" + (button.dataset.id || selected.id),
      );
      dirty = false;
      render();
      return;
    }
    if (cmd === "revoke-invite") {
      if (
        !confirm(
          "Disable this invitation? It will no longer let a client join.",
        )
      )
        return;
      await api("/invitations/" + button.dataset.id, { method: "DELETE" });
      return load();
    }
    if (cmd === "revoke-access" || cmd === "end-assignment") {
      if (
        !confirm(
          "End coaching access to this program? The program and recorded results will be kept.",
        )
      )
        return;
      await api(
        (cmd === "revoke-access" ? "/access/" : "/assignments/") +
          button.dataset.id,
        { method: "DELETE" },
      );
      return load();
    }
  } catch (e) {
    if (
      ["open-client", "refresh-client"].includes(cmd) &&
      [403, 404, 410].includes(e.status)
    ) {
      selected = null;
      dirty = false;
      try {
        data = await api();
      } catch {
        data = null;
      }
    }
    error = e.message;
    render();
  }
});
app.addEventListener("submit", async (event) => {
  const form = event.target;
  event.preventDefault();
  if (form.id === "coach-join-form") {
    if (!form.reportValidity()) return;
    const draft = {
      token,
      consent: true,
      startDate: form.elements.startDate.value,
      created: Date.now(),
      userId: cloud.account()?.id || null,
    };
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      if (!cloud.isSignedIn())
        return cloud.open(
          event.submitter.value === "signup" ? "signup" : "signin",
        );
      loading = true;
      render();
      await join();
    } catch (e) {
      loading = false;
      error = e.message;
      render();
    }
    return;
  }
  if (!form.matches(".coach-log") || !form.reportValidity()) return;
  const complete = event.submitter?.dataset.complete === "true";
  if (
    complete &&
    !confirm(
      `Mark this workout complete for ${selected.clientName}? Blank results will use the planned targets.`,
    )
  )
    return;
  const exercises = [...form.querySelectorAll("[data-exercise]")].map(
    (field) => ({
      id: field.dataset.exercise,
      note: field.querySelector("[data-note]").value,
      logs: [...field.querySelectorAll("[data-log]")].map((row) => ({
        weight: row.querySelector("[data-weight]").value,
        actual: row.querySelector("[data-actual]").value,
        done: row.querySelector("[data-done]").checked,
      })),
    }),
  );
  const buttons = [...form.querySelectorAll("button")];
  buttons.forEach((b) => (b.disabled = true));
  try {
    const result = await api(
      "/assignments/" +
        selected.id +
        "/workouts/" +
        encodeURIComponent(form.dataset.workout),
      {
        method: "PATCH",
        body: JSON.stringify({
          revision: selected.revision,
          exercises,
          complete,
        }),
      },
    );
    selected = { ...selected, ...result };
    dirty = false;
    openWorkout = form.dataset.workout;
    notice = "Workout progress saved for " + selected.clientName + ".";
    render();
  } catch (e) {
    form.querySelector(".form-error").textContent = e.message;
    buttons.forEach((b) => (b.disabled = false));
  }
});
render();
const started = await cloud.start();
if (!started.ok) {
  loading = false;
  error = "Could not connect to Buff. Check your connection and reload.";
  render();
} else await load();

window.addEventListener("pageshow", (event) => {
  if (event.persisted) location.reload();
});

window.addEventListener("beforeunload", (event) => {
  if (dirty) {
    event.preventDefault();
    event.returnValue = "";
  }
});
