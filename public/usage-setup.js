(() => {
  const key = "buff-usage-owner-setup";
  const token = new URLSearchParams(location.hash.slice(1)).get("setup");
  try {
    if (token && /^[a-f0-9]{64}$/.test(token))
      sessionStorage.setItem(key, token);
    if (location.hash) history.replaceState(null, "", location.pathname);
    const stored = sessionStorage.getItem(key);
    const field = document.querySelector('[name="setupToken"]');
    if (field && stored && /^[a-f0-9]{64}$/.test(stored)) {
      field.value = stored;
      document.querySelector("#setup-code-label").hidden = true;
      document.querySelector("#setup-help").textContent =
        "Your private setup link is ready. Confirm this is your account before enabling the dashboard.";
    }
  } catch {}
})();
