const KEY = "buff-pending-invitation";
const valid = (token) =>
  typeof token === "string" && /^[a-f0-9]{64}$/.test(token);
export function pendingInvitation() {
  const url = new URL(location.href);
  const incoming = url.searchParams.get("invite");
  if (incoming !== null) {
    if (!valid(incoming)) return null;
    try {
      sessionStorage.setItem(
        KEY,
        JSON.stringify({ token: incoming, created: Date.now() }),
      );
    } catch {}
    return incoming;
  }
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY));
    if (valid(saved?.token) && Date.now() - saved.created < 7 * 86400000)
      return saved.token;
  } catch {}
  return null;
}
export function clearInvitation() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {}
  const url = new URL(location.href);
  url.searchParams.delete("invite");
  history.replaceState(null, "", url.pathname + url.search + url.hash);
}
