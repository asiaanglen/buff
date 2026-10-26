export function setupPwa() {
  if (!("serviceWorker" in navigator) || !import.meta.env.PROD) return;
  navigator.serviceWorker.register("/sw.js").catch(() => {});
  const standalone = () =>
    window.matchMedia("(display-mode: standalone)").matches ||
    navigator.standalone;
  if (standalone()) return;
  let installPrompt;
  const container = document.createElement("div");
  container.innerHTML = `<button class="pwa-help" type="button">Install Buff</button><dialog class="pwa-dialog" aria-labelledby="pwa-title"><h2 id="pwa-title">Buff on your home screen</h2><p>Open Buff like an app, with your programs and history synced to your account.</p><p><strong>iPhone or iPad:</strong> Open this site in Safari, tap Share, then Add to Home Screen. Turn on Open as Web App if shown, then tap Add.</p><p><strong>Android:</strong> Open this site in Chrome, tap the menu, then Install app or Add to Home screen.</p><p class="pwa-note">Connect to the internet to open Buff and sign in. Once loaded, pending workout changes can sync when you reconnect.</p><button class="button primary pwa-install" type="button" hidden>Install now</button><button class="button subtle pwa-close" type="button">Close</button></dialog>`;
  document.body.append(container);
  const help = container.querySelector(".pwa-help");
  const dialog = container.querySelector("dialog");
  const install = container.querySelector(".pwa-install");
  help.addEventListener("click", () => dialog.showModal());
  container
    .querySelector(".pwa-close")
    .addEventListener("click", () => dialog.close());
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    install.hidden = false;
  });
  install.addEventListener("click", async () => {
    if (!installPrompt) return;
    const prompt = installPrompt;
    installPrompt = null;
    install.hidden = true;
    await prompt.prompt();
  });
  window.addEventListener("appinstalled", () => {
    dialog.close();
    help.hidden = true;
    installPrompt = null;
  });
}
