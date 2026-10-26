import { digest } from "./crypto.js";
export function sessionToken(request) {
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("buff_session="))
    ?.slice(13);
}
export async function identify(request, db) {
  const token = sessionToken(request);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  return db
    .prepare(
      "SELECT users.id,users.email FROM sessions JOIN users ON users.id=sessions.user_id WHERE token=? AND expires>?",
    )
    .bind(await digest(token), Date.now())
    .first();
}
export function cookie(request, token, clear = false) {
  return `buff_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${clear ? 0 : 30 * 86400}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}
export async function issueSessionCookie(request, db, user) {
  const token = crypto
    .getRandomValues(new Uint8Array(32))
    .reduce((s, v) => s + v.toString(16).padStart(2, "0"), "");
  await db
    .prepare("INSERT INTO sessions(token,user_id,expires) VALUES(?,?,?)")
    .bind(await digest(token), user.id, Date.now() + 30 * 86400000)
    .run();
  return cookie(request, token);
}
