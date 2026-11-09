import { mountAiCoach } from "./ai-programs.js";
import "./ai-program-popup.css";

export function setupAiProgramPopup({ cloud, getOwner, beforeOpen, onSaved }) {
  let panel,
    chat,
    owner,
    trigger,
    opening = false;
  const launcher = document.createElement("button");
  launcher.type = "button";
  launcher.className = "ai-chat-launcher";
  launcher.textContent = "✧ Buffy";
  launcher.setAttribute("aria-label", "Chat with Buffy");
  launcher.setAttribute("aria-controls", "buff-ai-chat-panel");
  launcher.setAttribute("aria-expanded", "false");
  document.body.append(launcher);
  const hide = () => {
    if (!panel) return;
    panel.hidden = true;
    launcher.setAttribute("aria-expanded", "false");
    if (trigger?.isConnected) trigger.focus();
    else launcher.focus();
  };
  const destroy = () => {
    chat?.destroy();
    panel?.remove();
    panel = chat = null;
    owner = null;
    launcher.setAttribute("aria-expanded", "false");
  };
  const open = async (source) => {
    if (!getOwner()) return;
    trigger = source;
    if (panel && owner === getOwner() && (chat || opening)) {
      panel.hidden = false;
      launcher.setAttribute("aria-expanded", "true");
      chat?.focus();
      return;
    }
    if (opening) return;
    destroy();
    owner = getOwner();
    opening = true;
    panel = document.createElement("section");
    panel.className = "ai-program-popup";
    panel.id = "buff-ai-chat-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-labelledby", "ai-popup-title");
    panel.innerHTML = `<header class="ai-popup-header"><div><strong id="ai-popup-title">Buffy</strong><small>Let’s build your next program.</small></div><div class="ai-popup-header-actions"><button class="ai-popup-new" type="button" aria-label="New chat" title="New chat" disabled>+</button><button class="ai-popup-close" type="button" aria-label="Close Buffy chat">×</button></div></header><div class="ai-coach-host"><p role="status">Connecting to Buffy…</p></div>`;
    panel.querySelector(".ai-popup-close").onclick = hide;
    const newChatButton = panel.querySelector(".ai-popup-new");
    newChatButton.onclick = () => chat?.newChat();
    panel.addEventListener("keydown", (event) => {
      if (
        event.key === "Escape" &&
        !document.querySelector("dialog[open], .modal-backdrop")
      ) {
        event.preventDefault();
        hide();
      }
    });
    document.body.append(panel);
    launcher.setAttribute("aria-expanded", "true");
    const host = panel.querySelector(".ai-coach-host");
    try {
      await beforeOpen();
      if (!panel || getOwner() !== owner) return;
      chat = mountAiCoach({
        container: host,
        cloud,
        onClose: hide,
        onSaved,
        onStateChange: ({ loading, saving }) => {
          newChatButton.disabled = loading || saving;
        },
        beforeSave: async () => {
          if (document.querySelector(".modal-backdrop, dialog[open]"))
            throw Error(
              "Finish or close the open editor before saving your AI program.",
            );
        },
      });
    } catch (error) {
      if (panel)
        host.textContent =
          error.message ||
          "Could not connect. Close and reopen the chat to try again.";
    } finally {
      opening = false;
    }
  };
  document.addEventListener("click", (event) => {
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
    void open(link);
  });
  launcher.onclick = () =>
    panel && !panel.hidden ? hide() : void open(launcher);
  const url = new URL(location.href);
  let autoOpen = url.searchParams.get("ai") === "1";
  if (autoOpen) {
    url.searchParams.delete("ai");
    history.replaceState(null, "", url.pathname + url.search + url.hash);
  }
  const checkAccount = (ready = false) => {
    if (owner && owner !== getOwner()) destroy();
    launcher.hidden = !getOwner();
    if (autoOpen && ready && getOwner()) {
      autoOpen = false;
      void open(launcher);
    }
  };
  checkAccount();
  return { checkAccount };
}
