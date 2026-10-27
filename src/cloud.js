import { profileFields, profileEditor } from "./account-profile.js";
import { pendingInvitation } from "./invite-token.js";
import { importGuest } from "./model.js";
import { authScheme, passwordProof } from "./credentials.js";
// Same-origin sessions stay in HttpOnly cookies; workout caches are scoped to each account.
export function createCloud({
  getState,
  setState,
  canApply,
  onStatus,
  onAuthenticated,
}) {
  let user = null,
    revision = 0,
    dirty = false,
    conflict = false,
    busy = null,
    timer,
    generation = 0,
    status = "Saved on this device",
    googleEnabled = false,
    googleLinked = false;
  const rawReturn = new URL(location.href).searchParams.get("buff_return_to");
  let returnTo = null;
  try {
    if (rawReturn) {
      const u = new URL(rawReturn, location.origin);
      if (
        u.origin === location.origin &&
        (u.pathname === "/oauth/authorize" ||
          u.pathname.startsWith("/approvals/") ||
          u.pathname === "/connections" ||
          u.pathname === "/usage" ||
          u.pathname === "/usage/setup")
      )
        returnTo = u.pathname + u.search;
    }
  } catch {
    returnTo = null;
  }
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
    const remote = await request("/state", {
      signal: AbortSignal.timeout(15000),
    });
    let cached;
    try {
      cached = JSON.parse(localStorage.getItem(`buff-account-${nextUser.id}`));
    } catch {}
    user = nextUser;
    if (user.isUsageOwner) {
      try {
        sessionStorage.removeItem("buff-usage-owner-setup");
      } catch {}
    }
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
  function queueSyncIssue() {
    if (!user) return;
    try {
      const key = "buff-sync-report-" + user.id;
      if (!sessionStorage.getItem(key))
        sessionStorage.setItem(key, crypto.randomUUID());
    } catch {}
  }
  async function sendSyncIssue() {
    if (!user) return;
    const id = user.id,
      key = "buff-sync-report-" + id;
    try {
      const report = sessionStorage.getItem(key);
      if (!report) return;
      const response = await fetch("/api/usage/events", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "sync_network_failure", id: report }),
        signal: AbortSignal.timeout(5000),
      });
      if (
        response.ok &&
        user?.id === id &&
        sessionStorage.getItem(key) === report
      )
        sessionStorage.removeItem(key);
    } catch {}
  }
  function journalUsage() {
    if (!user) return { bytes: 0, warning: false };
    const bytes = new TextEncoder().encode(
      JSON.stringify(getState()),
    ).byteLength;
    return { bytes, warning: bytes >= 768000 };
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
        void sendSyncIssue();
      } catch (e) {
        if (!e.status) queueSyncIssue();
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
  function googleControls() {
    if (!googleEnabled) return "";
    if (user)
      return googleLinked
        ? '<p class="google-connected">✓ Google is connected to your account.</p>'
        : '<button class="button subtle google-button" data-cloud="link-google">Connect Google to this account</button>';
    const invite = pendingInvitation();
    const target =
      returnTo ||
      (invite
        ? "/?invite=" + invite
        : location.pathname === "/app"
          ? "/app"
          : "/");
    return `<a class="google-button" href="/api/auth/google/start?return_to=${encodeURIComponent(target)}"><svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M43.6 24.5c0-1.5-.1-2.9-.4-4.3H24v8.2h11a9.4 9.4 0 0 1-4.1 6.2V40h6.7c3.9-3.6 6-8.9 6-15.5Z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9L31 34c-1.8 1.2-4.1 1.9-7 1.9-5.3 0-9.8-3.6-11.4-8.4H5.7V33A20.4 20.4 0 0 0 24 44Z"/><path fill="#FBBC05" d="M12.6 27.5a12.3 12.3 0 0 1 0-7v-5.6H5.7a20 20 0 0 0 0 18.2l6.9-5.6Z"/><path fill="#EA4335" d="M24 12.1c3 0 5.6 1 7.7 3l5.8-5.8A19.5 19.5 0 0 0 24 4 20.4 20.4 0 0 0 5.7 15l6.9 5.5c1.6-4.8 6.1-8.4 11.4-8.4Z"/></svg>Continue with Google</a><div class="auth-divider">or use email</div>`;
  }
  async function refreshProviders() {
    try {
      const p = await request("/auth/providers", {
        signal: AbortSignal.timeout(15000),
      });
      googleEnabled = p.google === true;
      googleLinked = p.googleLinked === true;
    } catch {
      googleEnabled = false;
    }
    const slot = root.querySelector("#google-auth-slot");
    if (slot) slot.innerHTML = googleControls();
  }
  function open(mode = "signin", message = "") {
    if (user?.profileRequired) {
      root.dataset.mode = "profile";
      root.innerHTML = `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="account-title"><div class="modal-header"><h2 id="account-title">Complete your profile</h2></div><p>Add your details to finish creating your Buff account.</p><p class="account-message" role="status">${escape(message)}</p><form id="profile-form">${profileFields(escape, user)}<button type="submit" class="button primary">Continue</button></form><div class="modal-footer"><button type="button" class="text-button" data-cloud="signout">Sign out</button></div></section></div>`;
      root.querySelector("input")?.focus();
      return;
    }
    if (user && mode === "edit-profile") {
      root.dataset.mode = mode;
      root.innerHTML = profileEditor(escape, user, message);
      root.querySelector("input")?.focus();
      return;
    }
    root.innerHTML = `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="account-title"><div class="modal-header"><div><div class="eyebrow">YOUR WORKOUTS, EVERYWHERE</div><h2 id="account-title">${user ? "Your account" : mode === "signup" ? "Create your account" : "Sign in to Buff"}</h2></div><button class="icon-button close" data-cloud="close" aria-label="Close account">×</button></div><p class="account-intro">${user ? `Signed in as <strong>${escape(user.email)}</strong>` : "Use the same account on every device to sync your plans and workout logs."}</p><p class="account-message" role="status">${escape(message)}</p><div id="google-auth-slot">${googleControls()}</div>${user ? `<p class="sync-detail" data-sync-status>${escape(status)}</p><div class="account-actions"><button class="button subtle" data-cloud="edit-profile">Edit profile</button><button class="button primary" data-cloud="sync">Sync now</button><button class="button subtle" data-cloud="download">Download a backup</button></div><div class="conflict-actions" ${conflict ? "" : "hidden"}><h3>Two devices changed your journal</h3><p>Neither version has been overwritten. Download your local backup before choosing.</p><button class="button subtle" data-cloud="use-cloud">Use cloud version</button><button class="button subtle" data-cloud="use-local">Replace cloud with this device</button></div><p class="account-help">Changes save automatically. You can safely keep editing when offline; pending changes sync when the server is reachable.</p><p><a class="text-button" href="/connections">Manage connected AI apps →</a></p>${user.isUsageOwner ? '<p><a class="text-button" href="/usage">Usage dashboard →</a></p>' : ""}${journalUsage().warning ? '<p class="account-help journal-storage-warning" role="status">Your workout history is approaching the 1 MB sync limit. Download a backup before removing older workouts to make room.</p>' : ""}<div class="modal-footer"><button class="text-button" data-cloud="import">Import guest workouts</button><button class="text-button danger" data-cloud="signout">Sign out</button></div>` : `<form id="auth-form">${mode === "signup" ? profileFields(escape) : ""}<label>Email<input name="email" type="email" autocomplete="email" required maxlength="254"></label><label>Password<input name="password" type="password" autocomplete="${mode === "signup" ? "new-password" : "current-password"}" required maxlength="200"></label><button class="button primary auth-submit" type="submit">${mode === "signup" ? "Create account" : "Sign in"} →</button></form><button class="text-button auth-switch" data-cloud="${mode === "signup" ? "signin" : "signup"}">${mode === "signup" ? "Already have an account? Sign in" : "New to Buff? Create an account"}</button><p class="account-help">Guest workouts stay on this device. Your first cloud journal starts with your device’s workouts. Password reset is not available yet; keep your password somewhere safe.</p>`}</section></div>`;
    void refreshProviders();
    root.dataset.mode = mode;
    root.querySelector("input,button")?.focus();
  }
  root.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.target;
    if (!form.reportValidity()) return;
    const b = event.submitter || form.querySelector('[type="submit"]');
    b.disabled = true;
    const data = Object.fromEntries(new FormData(form));
    try {
      if (form.id === "edit-profile-form") {
        const email = data.email.trim().toLowerCase();
        const current = data.currentPassword || "",
          next = data.newPassword || "";
        if (next !== (data.confirmPassword || ""))
          throw Error("New passwords do not match.");
        const credentialChange = email !== user.email || next !== "";
        delete data.currentPassword;
        delete data.newPassword;
        delete data.confirmPassword;
        data.email = email;
        if (credentialChange) {
          if (!current) {
            form.elements.currentPassword?.focus();
            throw Error(
              "Enter your current password to change your email or password.",
            );
          }
          const session = await request("/auth/session");
          if (session.authScheme === authScheme) {
            data.currentPassword = await passwordProof(user.email, current);
            data.newPassword = await passwordProof(email, next || current);
            data.credentialVersion = authScheme;
          } else {
            data.currentPassword = current;
            data.newPassword = next || current;
          }
        }
        const result = await request("/auth/profile", {
          method: "POST",
          body: JSON.stringify(data),
        });
        user = result.user;
        notify(status);
        open("signin", "Profile updated.");
        return;
      }
      if (form.id === "profile-form") {
        const result = await request("/auth/profile", {
          method: "POST",
          body: JSON.stringify(data),
        });
        user = result.user;
        notify(status);
        if (returnTo) {
          location.assign(returnTo);
          return;
        }
        if (onAuthenticated && (await onAuthenticated())) {
          root.innerHTML = "";
          return;
        }
        open();
        return;
      }
      const session = await request("/auth/session");
      if (session.authScheme === authScheme) {
        data.password = await passwordProof(data.email, data.password);
        data.credentialVersion = authScheme;
      }
      const result = await request(`/auth/${root.dataset.mode}`, {
        method: "POST",
        body: JSON.stringify(data),
      });
      await loadAccount(result.user);
      if (returnTo) {
        location.assign(returnTo);
        return;
      }
      if (onAuthenticated && (await onAuthenticated())) {
        root.innerHTML = "";
        return;
      }
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
      if (user?.profileRequired) return;
      root.innerHTML = "";
      return;
    }
    if (action === "signin" || action === "signup") {
      open(action);
      return;
    }
    b.disabled = true;
    try {
      if (action === "edit-profile") {
        const session = await request("/auth/session");
        if (!session.user)
          throw Error(
            "Your session expired. Sign in again to edit your profile.",
          );
        user = session.user;
        open("edit-profile");
        return;
      }
      if (action === "account") {
        open();
        return;
      }
      if (action === "link-google") {
        const result = await request(
          "/auth/google/link?return_to=" +
            encodeURIComponent(location.pathname === "/app" ? "/app" : "/"),
          { method: "POST", body: "{}" },
        );
        location.assign(result.url);
        return;
      }
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
          setState(remote.state || { version: 1, unit: "lbs", workouts: [] });
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
        const imported = importGuest(getState(), guest);
        if (imported.workouts || imported.programs) {
          setState(imported.state);
          save();
          await sync();
        }
        open(
          "signin",
          `${imported.workouts} guest workouts and ${imported.programs} programs imported. Existing workouts were kept unchanged.`,
        );
      }

      if (action === "signout") {
        await busy;
        await request("/auth/signout", { method: "POST", body: "{}" });
        user = null;
        history.replaceState(null, "", "/");
        dirty = false;
        conflict = false;
        revision = 0;
        clearTimeout(timer);
        let guest;
        try {
          guest = JSON.parse(localStorage.getItem("buff-v1"));
        } catch {}
        setState(guest || { version: 1, unit: "lbs", workouts: [] });
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
    if (e.key === "Escape" && !user?.profileRequired) root.innerHTML = "";
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
  }, 30000);
  return {
    save,
    open,
    journalUsage,
    async flush() {
      clearTimeout(timer);
      await sync();
      if (dirty && !conflict) await sync();
      if (!user || dirty || conflict || status !== "Synced")
        throw Error(
          "Your changes need to sync before sharing or adding this program. Resolve any sync conflict and try again.",
        );
    },
    async refresh() {
      if (user) await loadAccount(user);
    },
    isSignedIn: () => Boolean(user) && !user.profileRequired,
    label: () => (user ? `${status} · ${user.email}` : status),
    async start() {
      try {
        const [{ user: sessionUser }] = await Promise.all([
          request("/auth/session", { signal: AbortSignal.timeout(15000) }),
          refreshProviders(),
        ]);
        const errors = {
          google_failed:
            "Google sign-in could not be completed. Please try again.",
          google_cancelled: "Google sign-in was cancelled.",
          google_account_exists:
            "A Buff account already uses this email. Sign in with your password, then connect Google in Account.",
          google_identity_in_use:
            "This Google account is already connected to another Buff account.",
          google_session_changed:
            "Your Buff session changed. Sign in and connect Google again.",
        };
        const query = new URL(location.href),
          message = errors[query.searchParams.get("auth_error")] || "";
        if (query.searchParams.has("auth_error")) {
          query.searchParams.delete("auth_error");
          history.replaceState(
            null,
            "",
            query.pathname + query.search + query.hash,
          );
        }

        if (sessionUser) {
          await loadAccount(sessionUser);
          if (user.profileRequired) open();
          else if (returnTo) location.assign(returnTo);
          else if (message) open("signin", message);
        } else {
          if (!returnTo && location.pathname !== "/")
            history.replaceState(null, "", "/");
          if (returnTo || message) open("signin", message);
        }
      } catch {
        notify("Device only — sync server unavailable");
        return { ok: false };
      }
      return { ok: true };
    },
  };
}
