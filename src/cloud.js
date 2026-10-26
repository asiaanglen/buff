// Same-origin sessions stay in HttpOnly cookies; workout caches are scoped to each account.
export function createCloud({ getState, setState, canApply, onStatus }) {
  let user = null,
    revision = 0,
    dirty = false,
    conflict = false,
    busy = null,
    timer,
    generation = 0,
    status = "Saved on this device";
  const root = document.createElement("div");
  root.id = "account-root";
  document.body.append(root);
  const escape = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const cacheKey = () => (user ? `buff-account-${user.id}` : "buff-v1");
  function persist() {
    try {
      localStorage.setItem(
        cacheKey(),
        JSON.stringify(
          user ? { state: getState(), revision, dirty } : getState(),
        ),
      );
    } catch {
      notify("Device storage full — keep this tab open");
    }
  }
  function notify(s) {
    status = s;
    onStatus(user ? `${s} · ${user.email}` : s);
    const label = root.querySelector("[data-sync-status]");
    if (label) label.textContent = s;
  }
  async function request(path, options = {}) {
    const response = await fetch("/api" + path, {
      credentials: "same-origin",
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
    });
    const body = await response.json();
    if (!response.ok) {
      const e = new Error(body.error || "Request failed.");
      e.status = response.status;
      throw e;
    }
    return body;
  }
  async function loadAccount(nextUser) {
    const remote = await request("/state");
    let cached;
    try {
      cached = JSON.parse(localStorage.getItem(`buff-account-${nextUser.id}`));
    } catch {}
    user = nextUser;
    revision = remote.revision;
    dirty = false;
    conflict = false;
    generation++;
    if (cached?.dirty && cached.state?.version === 1) {
      setState(cached.state);
      dirty = true;
      conflict = cached.revision !== revision;
      revision = cached.revision; // Preserve the base revision across reloads until conflict resolution.
    } else if (remote.state) setState(remote.state);
    else {
      let guest;
      try {
        guest = JSON.parse(localStorage.getItem("buff-v1"));
      } catch {}
      setState(guest?.version === 1 ? guest : getState());
      dirty = true;
    }
    persist();
    notify(
      conflict
        ? "Sync conflict — choose which version to keep"
        : dirty
          ? "Waiting to sync"
          : "Synced",
    );
    if (dirty && !conflict) await sync();
  }
  async function sync() {
    if (!user || conflict) return;
    if (busy) return busy;
    busy = (async () => {
      try {
        if (dirty) {
          notify("Syncing…");
          const version = generation;
          const result = await request("/state", {
            method: "PUT",
            body: JSON.stringify({
              state: structuredClone(getState()),
              revision,
            }),
          });
          revision = result.revision;
          if (version === generation) dirty = false;
          persist();
          notify(dirty ? "Waiting to sync" : "Synced");
        } else {
          const before = generation;
          const remote = await request("/state");
          if (remote.revision !== revision) {
            if (dirty || generation !== before) {
              conflict = true;
              notify("Sync conflict — choose which version to keep");
              return;
            }
            if (!canApply()) {
              notify("Updates available — close the editor to refresh");
              return;
            }
            if (remote.state) {
              revision = remote.revision;
              setState(remote.state);
              persist();
            }
            notify("Synced");
          }
        }
      } catch (e) {
        if (e.status === 409) {
          conflict = true;
          notify("Sync conflict — choose which version to keep");
        } else if (e.status === 401)
          notify("Session expired — sign in again to sync");
        else notify("Offline or server unavailable — changes pending");
      }
    })();
    try {
      await busy;
    } finally {
      busy = null;
    }
    if (dirty && !conflict && status === "Waiting to sync") schedule();
  }
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(sync, 400);
  }
  function save() {
    generation++;
    if (user) dirty = true;
    persist();
    if (user) {
      notify(
        conflict
          ? "Sync conflict — changes kept on this device"
          : "Waiting to sync",
      );
      if (!conflict) schedule();
    }
  }
  function open(mode = "signin", message = "") {
    root.innerHTML = `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="account-title"><div class="modal-header"><div><div class="eyebrow">YOUR WORKOUTS, EVERYWHERE</div><h2 id="account-title">${user ? "Your account" : mode === "signup" ? "Create your account" : "Sign in to Buff"}</h2></div><button class="icon-button close" data-cloud="close" aria-label="Close account">×</button></div><p class="account-intro">${user ? `Signed in as <strong>${escape(user.email)}</strong>` : "Use the same account on every device to sync your plans and workout logs."}</p><p class="account-message" role="status">${escape(message)}</p>${user ? `<p class="sync-detail" data-sync-status>${escape(status)}</p><div class="account-actions"><button class="button primary" data-cloud="sync">Sync now</button><button class="button subtle" data-cloud="download">Download a backup</button></div><div class="conflict-actions" ${conflict ? "" : "hidden"}><h3>Two devices changed your journal</h3><p>Neither version has been overwritten. Download your local backup before choosing.</p><button class="button subtle" data-cloud="use-cloud">Use cloud version</button><button class="button subtle" data-cloud="use-local">Replace cloud with this device</button></div><p class="account-help">Changes save automatically. You can safely keep editing when offline; pending changes sync when the server is reachable.</p><div class="modal-footer"><button class="text-button" data-cloud="import">Import guest workouts</button><button class="text-button danger" data-cloud="signout">Sign out</button></div>` : `<form id="auth-form"><label>Email<input name="email" type="email" autocomplete="email" required maxlength="254"></label><label>Password<input name="password" type="password" autocomplete="${mode === "signup" ? "new-password" : "current-password"}" required minlength="12" maxlength="200"><small>At least 12 characters.</small></label><button class="button primary auth-submit" type="submit">${mode === "signup" ? "Create account" : "Sign in"} →</button></form><button class="text-button auth-switch" data-cloud="${mode === "signup" ? "signin" : "signup"}">${mode === "signup" ? "Already have an account? Sign in" : "New to Buff? Create an account"}</button><p class="account-help">Guest workouts stay on this device. Your first cloud journal starts with your device’s workouts. Password reset is not available yet; keep your password somewhere safe.</p>`}</section></div>`;
    root.dataset.mode = mode;
    root.querySelector("input,button")?.focus();
  }
  root.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.target;
    if (!form.reportValidity()) return;
    const b = form.querySelector("button");
    b.disabled = true;
    const data = Object.fromEntries(new FormData(form));
    try {
      const result = await request(`/auth/${root.dataset.mode}`, {
        method: "POST",
        body: JSON.stringify(data),
      });
      await loadAccount(result.user);
      open();
    } catch (e) {
      root.querySelector(".account-message").textContent = e.message;
    } finally {
      b.disabled = false;
    }
  });
  root.addEventListener("click", async (event) => {
    const b = event.target.closest("[data-cloud]");
    if (!b) return;
    const action = b.dataset.cloud;
    if (action === "close") {
      root.innerHTML = "";
      return;
    }
    if (action === "signin" || action === "signup") {
      open(action);
      return;
    }
    b.disabled = true;
    try {
      if (action === "sync") {
        await sync();
        open();
      }
      if (action === "download") {
        const blob = new Blob([JSON.stringify(getState(), null, 2)], {
          type: "application/json",
        });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "buff-workout-backup.json";
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      }
      if (action === "use-cloud" || action === "use-local") {
        if (
          !confirm(
            action === "use-cloud"
              ? "Replace the journal on this device with the cloud version? Download a backup first if you need these local changes."
              : "Replace the cloud journal with this device’s version? Other devices will receive this version.",
          )
        )
          return;
        await busy;
        const remote = await request("/state");
        revision = remote.revision;
        conflict = false;
        if (action === "use-cloud") {
          setState(remote.state || { version: 1, unit: "kg", workouts: [] });
          dirty = false;
          persist();
          notify("Synced");
        } else {
          dirty = true;
          await sync();
        }
        open();
      }
      if (action === "import") {
        let guest;
        try {
          guest = JSON.parse(localStorage.getItem("buff-v1"));
        } catch {}
        const current = structuredClone(getState());
        const ids = new Set(current.workouts.map((w) => w.id));
        const extras = (guest?.workouts || []).filter((w) => !ids.has(w.id));
        if (extras.length) {
          current.workouts.push(...extras);
          setState(current);
          save();
          await sync();
        }
        open(
          "signin",
          `${extras.length} guest workouts imported. Existing workout IDs were kept unchanged.`,
        );
      }
      if (action === "signout") {
        await busy;
        await request("/auth/signout", { method: "POST", body: "{}" });
        user = null;
        dirty = false;
        conflict = false;
        revision = 0;
        clearTimeout(timer);
        let guest;
        try {
          guest = JSON.parse(localStorage.getItem("buff-v1"));
        } catch {}
        setState(guest || { version: 1, unit: "kg", workouts: [] });
        notify("Saved on this device");
        root.innerHTML = "";
      }
    } catch (e) {
      root.querySelector(".account-message").textContent = e.message;
    } finally {
      b.disabled = false;
    }
  });
  root.addEventListener("keydown", (e) => {
    if (e.key === "Escape") root.innerHTML = "";
    if (e.key === "Tab") {
      const els = [
        ...root.querySelectorAll("button:not([disabled]),input"),
      ].filter((el) => el.getClientRects().length);
      const first = els[0],
        last = els.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });
  window.addEventListener("online", sync);
  window.addEventListener("focus", sync);
  setInterval(() => {
    if (document.visibilityState === "visible") sync();
  }, 10000);
  return {
    save,
    open,
    label: () => (user ? `${status} · ${user.email}` : status),
    async start() {
      try {
        const { user: sessionUser } = await request("/auth/session");
        if (sessionUser) await loadAccount(sessionUser);
      } catch {
        notify("Device only — sync server unavailable");
      }
    },
  };
}
