import "./ai-program-popup.css";

// One shared popup for both workspaces; only its own same-origin chat may signal saves.
export function setupAiProgramPopup({ getOwner, beforeOpen, onSaved }) {
  let dialog,
    frame,
    owner,
    trigger,
    busy = false,
    opening = false,
    updating = false;
  const close = () => {
    if (!dialog || updating) return;
    if (
      busy &&
      !confirm(
        "Your coach is still working. Close the chat? Your last successful conversation is saved.",
      )
    )
      return;
    dialog.close();
    dialog.remove();
    dialog = frame = null;
    document.body.classList.remove("ai-popup-open");
    if (trigger?.isConnected) trigger.focus();
    else document.querySelector('a[href^="/create-with-ai"]')?.focus();
  };
  const updatePrograms = async (programId) => {
    if (updating || getOwner() !== owner) return;
    updating = true;
    const error = dialog.querySelector(".ai-popup-error");
    error.hidden = true;
    try {
      await onSaved(programId);
      updating = false;
      busy = false;
      close();
    } catch {
      updating = false;
      error.hidden = false;
      error.querySelector("p").textContent =
        "Your program was saved, but the library could not refresh. Try again.";
      error.querySelector("button").onclick = () => updatePrograms(programId);
    }
  };
  document.addEventListener("click", async (event) => {
    const link = event.target.closest('a[href^="/create-with-ai"]');
    if (
      !link ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      !getOwner()
    )
      return;
    event.preventDefault();
    if (dialog || opening) return;
    opening = true;
    trigger = link;
    owner = getOwner();
    dialog = document.createElement("dialog");
    dialog.className = "ai-program-popup";
    dialog.setAttribute("aria-labelledby", "ai-popup-title");
    dialog.innerHTML = `<header class="ai-popup-header"><div><strong id="ai-popup-title">Create a program with AI</strong><small>Chat, review, and save your program.</small></div><button class="ai-popup-close" type="button" aria-label="Close AI chat">×</button></header><div class="ai-popup-error" role="alert" hidden><p></p><button type="button">Try again</button></div><p class="ai-popup-loading" role="status">Opening your coach…</p>`;
    document.body.append(dialog);
    document.body.classList.add("ai-popup-open");
    dialog.addEventListener("cancel", (e) => {
      e.preventDefault();
      close();
    });
    dialog.querySelector(".ai-popup-close").onclick = close;
    dialog.showModal();
    busy = false;
    try {
      await beforeOpen();
      if (!dialog || getOwner() !== owner) return;
      const url = new URL(link.href);
      url.searchParams.set("embedded", "1");
      frame = document.createElement("iframe");
      frame.title = "AI program coach";
      frame.src = url.href;
      frame.addEventListener("load", () =>
        dialog?.querySelector(".ai-popup-loading")?.remove(),
      );
      dialog.append(frame);
    } catch (error) {
      if (dialog)
        dialog.querySelector(".ai-popup-loading").textContent =
          error.message ||
          "Could not open the coach. Close this window and try again.";
    } finally {
      opening = false;
    }
  });
  window.addEventListener("message", (event) => {
    if (
      !dialog ||
      !frame ||
      event.origin !== location.origin ||
      event.source !== frame.contentWindow ||
      getOwner() !== owner
    )
      return;
    if (event.data?.type === "buff-ai:busy") busy = event.data.busy === true;
    if (event.data?.type === "buff-ai:close") close();
    if (
      event.data?.type === "buff-ai:saved" &&
      typeof event.data.programId === "string"
    )
      void updatePrograms(event.data.programId);
  });
}
