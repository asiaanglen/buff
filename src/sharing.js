export async function sharingRequest(path, options = {}) {
  const response = await fetch("/api/program-shares" + path, {
    credentials: "same-origin",
    signal: AbortSignal.timeout(15000),
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const result = await response.json();
  if (!response.ok)
    throw Object.assign(
      new Error(result.error || "Could not complete this invitation."),
      { status: response.status },
    );
  return result;
}
export const invitationMessage = (url) =>
  `Wanna get buff with me? Try out this new workout program!\n${url}`;
export function smsLink(message) {
  const ios =
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return `sms:${ios ? "&" : "?"}body=${encodeURIComponent(message)}`;
}
export function invitationBanner({ info, error, busy, signedIn, esc }) {
  if (!info && !error && !busy) return "";
  return `<section class="invitation-banner" aria-label="Workout program invitation"><div class="eyebrow">GET BUFF TOGETHER</div><h2>${info ? `${esc(info.inviterName)} invited you to get buff!` : "Program invitation"}</h2>${info ? `<p>Try <strong>${esc(info.programName)}</strong> · ${info.weeks} weeks · ${info.workoutCount} workouts.</p>` : ""}<p role="status">${busy ? "Adding this program to your Programs…" : error ? esc(error) : signedIn ? "Your own copy will be added to Programs." : "Sign up or sign in to add your own copy to Programs. Your friend’s workout history stays private."}</p>${error ? '<div class="invitation-actions"><button class="button subtle" data-action="retry-invitation">Try invitation again</button><button class="text-button" data-action="dismiss-invitation">Dismiss invitation</button></div>' : !signedIn ? '<div class="invitation-actions"><button class="button primary" data-action="landing-signup">Sign up &amp; get program</button><button class="button subtle" data-action="landing-signin">Sign in</button></div>' : ""}</section>`;
}
export function createSharing({ getState, save, flush, esc }) {
  let activeDialog;
  async function open(programId) {
    const program = (getState().programs || []).find(
      (program) => program.id === programId,
    );
    if (!program) return;
    if (activeDialog?.open) activeDialog.close();
    activeDialog?.remove();
    const dialog = document.createElement("dialog");
    activeDialog = dialog;
    dialog.id = "program-share-dialog";
    dialog.className = "program-share-dialog";
    document.body.append(dialog);
    dialog.setAttribute("aria-labelledby", "share-program-title");
    dialog.innerHTML = `<div class="modal-header"><div><div class="eyebrow">GET BUFF TOGETHER</div><h2 id="share-program-title">Share program</h2></div><button type="button" class="icon-button" aria-label="Close sharing">×</button></div><p>Invite a friend to try <strong>${esc(program.name)}</strong>. They’ll get their own copy after signing up or signing in.</p><p class="share-privacy">The program plan is shared. Your logged results and exercise session notes stay private.</p><p class="share-status" role="status"></p><button type="button" class="button subtle share-retry" hidden>Try again</button><section class="share-result" hidden><label for="share-message">Invitation message</label><textarea id="share-message" readonly rows="5"></textarea><div class="share-actions"><a class="button primary share-sms" href="#">Choose contact in Messages</a><button type="button" class="button subtle share-native" ${typeof navigator.share === "function" ? "" : "hidden"}>Share…</button><button type="button" class="button subtle share-copy">Copy invitation</button></div><p class="share-help">Messages opens with your invitation filled in. On iPhone, tap + in the To field to choose someone from Contacts, then tap Send. You can also use Share… to choose another messaging app.</p></section><details class="share-manage"><summary>Manage invitation links</summary><div class="share-links"></div></details>`;
    const status = dialog.querySelector(".share-status");
    dialog
      .querySelector('[aria-label="Close sharing"]')
      .addEventListener("click", () => dialog.close());
    async function loadLinks() {
      const { links } = await sharingRequest(
        "?program_id=" + encodeURIComponent(programId),
      );
      const root = dialog.querySelector(".share-links");
      root.innerHTML =
        links
          .map(
            (link) =>
              `<div><span>${esc(link.inviterName)} · ${new Date(link.created).toLocaleDateString()}</span><button type="button" class="text-button danger" data-disable-link="${link.token}">Disable link</button></div>`,
          )
          .join("") || "<p>No invitation links yet.</p>";
    }
    dialog
      .querySelector(".share-links")
      .addEventListener("click", async (event) => {
        const button = event.target.closest("[data-disable-link]");
        if (!button) return;
        button.disabled = true;
        try {
          await sharingRequest("/" + button.dataset.disableLink, {
            method: "DELETE",
          });
          status.textContent =
            "Invitation link disabled. Copies already added by friends are kept.";
          dialog.querySelector(".share-result").hidden = true;
          await loadLinks();
        } catch (error) {
          status.textContent = error.message;
          button.disabled = false;
        }
      });
    const retry = dialog.querySelector(".share-retry");
    async function prepareInvitation() {
      retry.hidden = true;
      status.textContent = "Preparing your invitation…";
      try {
        const name = getState().displayName || "Your friend";
        save();
        await flush();
        const result = await sharingRequest("", {
          method: "POST",
          body: JSON.stringify({ programId, inviterName: name }),
        });
        const message = invitationMessage(result.url);
        dialog.querySelector("#share-message").value = message;
        dialog.querySelector(".share-sms").href = smsLink(message);
        dialog.querySelector(".share-result").hidden = false;
        status.textContent =
          "Invitation ready. Choose your recipient in Messages.";
        dialog.querySelector(".share-copy").onclick = async () => {
          try {
            await navigator.clipboard.writeText(message);
            status.textContent = "Invitation copied.";
          } catch {
            dialog.querySelector("#share-message").focus();
            dialog.querySelector("#share-message").select();
            status.textContent =
              "Message selected. Use your device’s Copy command.";
          }
        };
        dialog.querySelector(".share-native").onclick = async () => {
          try {
            await navigator.share({
              title: "Get buff together",
              text: message,
            });
            status.textContent = "Share sheet closed.";
          } catch (error) {
            if (error.name !== "AbortError")
              status.textContent =
                "Sharing is unavailable. Use Choose contact in Messages or Copy invitation.";
          }
        };
        await loadLinks();
      } catch (error) {
        status.textContent = error.message;
        retry.hidden = false;
      }
    }
    retry.addEventListener("click", prepareInvitation);
    dialog.showModal();
    prepareInvitation();
    loadLinks().catch((error) => {
      dialog.querySelector(".share-links").textContent = error.message;
    });
  }
  return { open };
}
