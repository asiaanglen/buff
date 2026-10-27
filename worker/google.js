import { createRemoteJWKSet, jwtVerify, base64url } from "jose";
import { randomHex, digest } from "./crypto.js";
import { identify, sessionToken, issueSessionCookie } from "./session.js";
const googleKeys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
  { timeoutDuration: 5000 },
);
export const googleConfigured = (env) =>
  Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
export async function verifyGoogleToken(token, clientId, key = googleKeys) {
  const { payload } = await jwtVerify(token, key, {
    algorithms: ["RS256"],
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: clientId,
    maxTokenAge: "10m",
    clockTolerance: 60,
  });
  if (
    typeof payload.sub !== "string" ||
    !payload.sub ||
    payload.sub.length > 255 ||
    typeof payload.email !== "string" ||
    payload.email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email) ||
    payload.email_verified !== true ||
    typeof payload.nonce !== "string" ||
    typeof payload.exp !== "number" ||
    (payload.azp !== undefined && payload.azp !== clientId) ||
    (Array.isArray(payload.aud) &&
      payload.aud.length > 1 &&
      payload.azp !== clientId)
  )
    throw Error("Invalid Google identity");
  return payload;
}
function flowCookie(request, value, clear = false) {
  const secure = new URL(request.url).protocol === "https:";
  return `${secure ? "__Host-" : ""}buff_google_state=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${clear ? 0 : 600}${secure ? "; Secure" : ""}`;
}
function flowCookieValue(request) {
  const secure = new URL(request.url).protocol === "https:";
  const prefix = (secure ? "__Host-" : "") + "buff_google_state=";
  return (
    request.headers
      .get("Cookie")
      ?.split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith(prefix))
      ?.slice(prefix.length) || ""
  );
}
export function safeGoogleReturn(value, origin) {
  try {
    const u = new URL(value || "/", origin);
    if (
      u.origin === origin &&
      (u.pathname === "/" ||
        u.pathname === "/app" ||
        u.pathname === "/connections" ||
        u.pathname === "/usage" ||
        u.pathname === "/usage/setup" ||
        u.pathname === "/oauth/authorize" ||
        u.pathname.startsWith("/approvals/"))
    )
      return u.pathname + u.search;
  } catch {}
  return "/";
}
function finish(request, target, error, cookie) {
  const origin = new URL(request.url).origin;
  let destination;
  if (
    new URL(target, origin).pathname === "/" ||
    new URL(target, origin).pathname === "/app"
  )
    destination = new URL(target, origin);
  else
    destination = new URL(
      "/?buff_return_to=" + encodeURIComponent(target),
      origin,
    );
  if (error) destination.searchParams.set("auth_error", error);
  const headers = new Headers({
    Location: destination.href,
    "Cache-Control": "no-store",
    "Referrer-Policy": "same-origin",
  });
  headers.append("Set-Cookie", flowCookie(request, "", true));
  if (cookie) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 303, headers });
}
export async function handleGoogle(
  request,
  env,
  { fetcher = fetch, verify = verifyGoogleToken } = {},
) {
  const url = new URL(request.url),
    path = url.pathname,
    db = env.DB;
  if (!googleConfigured(env))
    return Response.json(
      { error: "Google sign-in has not been configured." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  if (
    (path === "/api/auth/google/start" && request.method === "GET") ||
    (path === "/api/auth/google/link" && request.method === "POST")
  ) {
    const link = path.endsWith("/link"),
      user = link ? await identify(request, db) : null;
    if (link && (!user || request.headers.get("Origin") !== url.origin))
      return Response.json(
        { error: "Sign in to Buff before linking Google." },
        { status: 403 },
      );
    const state = randomHex(),
      browser = randomHex(),
      verifier = randomHex(),
      nonce = randomHex(),
      target = safeGoogleReturn(url.searchParams.get("return_to"), url.origin);
    await db
      .prepare("DELETE FROM google_auth_flows WHERE expires<=?")
      .bind(Date.now())
      .run();
    await db
      .prepare(
        "INSERT INTO google_auth_flows(id,cookie_hash,verifier,nonce_hash,return_to,link_user_id,session_hash,expires) VALUES(?,?,?,?,?,?,?,?)",
      )
      .bind(
        await digest(state),
        await digest(browser),
        verifier,
        await digest(nonce),
        target,
        user?.id || null,
        user ? await digest(sessionToken(request)) : null,
        Date.now() + 600000,
      )
      .run();
    const to = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    to.search = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: url.origin + "/api/auth/google/callback",
      response_type: "code",
      scope: "openid email profile",
      state,
      nonce,
      code_challenge: base64url.encode(
        await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(verifier),
        ),
      ),
      code_challenge_method: "S256",
      prompt: "select_account",
    }).toString();
    const headers = new Headers({
      "Cache-Control": "no-store",
      "Set-Cookie": flowCookie(request, browser),
    });
    if (link) {
      headers.set("Content-Type", "application/json");
      return new Response(JSON.stringify({ url: to.href }), { headers });
    }
    headers.set("Location", to.href);
    return new Response(null, { status: 302, headers });
  }
  if (path !== "/api/auth/google/callback" || request.method !== "GET")
    return Response.json(
      { error: "Unknown Google sign-in endpoint." },
      { status: 404 },
    );
  const state = url.searchParams.get("state") || "",
    browser = flowCookieValue(request);
  if (!/^[a-f0-9]{64}$/.test(state) || !/^[a-f0-9]{64}$/.test(browser))
    return finish(request, "/", "google_failed");
  const flow = await db
    .prepare(
      "DELETE FROM google_auth_flows WHERE id=? AND cookie_hash=? AND expires>? RETURNING *",
    )
    .bind(await digest(state), await digest(browser), Date.now())
    .first();
  if (!flow) return finish(request, "/", "google_failed");
  if (url.searchParams.has("error"))
    return finish(request, flow.return_to, "google_cancelled");
  try {
    if (flow.link_user_id) {
      const current = await identify(request, db);
      if (
        current?.id !== flow.link_user_id ||
        (await digest(sessionToken(request) || "")) !== flow.session_hash
      )
        return finish(request, flow.return_to, "google_session_changed");
    }
    const code = url.searchParams.get("code");
    if (!code || code.length > 4096) throw Error("Missing code");
    const tokenResponse = await fetcher("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: url.origin + "/api/auth/google/callback",
        code_verifier: flow.verifier,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!tokenResponse.ok) throw Error("Google exchange failed");
    const tokens = await tokenResponse.json();
    if (typeof tokens.id_token !== "string")
      throw Error("Missing identity token");
    const profile = await verify(tokens.id_token, env.GOOGLE_CLIENT_ID);
    if ((await digest(profile.nonce)) !== flow.nonce_hash)
      throw Error("Google nonce mismatch");
    let user = await db
      .prepare(
        "SELECT users.id,users.email FROM google_identities JOIN users ON users.id=google_identities.user_id WHERE subject=?",
      )
      .bind(profile.sub)
      .first();
    if (flow.link_user_id) {
      if (user && user.id !== flow.link_user_id)
        return finish(request, flow.return_to, "google_identity_in_use");
      if (!user) {
        try {
          await db
            .prepare(
              "INSERT INTO google_identities(subject,user_id) VALUES(?,?)",
            )
            .bind(profile.sub, flow.link_user_id)
            .run();
        } catch {
          return finish(request, flow.return_to, "google_identity_in_use");
        }
      }
      user = await db
        .prepare("SELECT id,email FROM users WHERE id=?")
        .bind(flow.link_user_id)
        .first();
    } else if (!user) {
      const email = profile.email.trim().toLowerCase();
      if (
        await db
          .prepare("SELECT id FROM users WHERE email=?")
          .bind(email)
          .first()
      )
        return finish(request, flow.return_to, "google_account_exists");
      user = { id: randomHex(16), email };
      try {
        await db.batch([
          db
            .prepare(
              "INSERT INTO users(id,email,password,salt,first_name,last_name,profile_required) VALUES(?,?,?,?,?,?,1)",
            )
            .bind(
              user.id,
              email,
              "google-only:" + randomHex(),
              randomHex(),
              typeof profile.given_name === "string"
                ? profile.given_name.trim().slice(0, 80)
                : null,
              typeof profile.family_name === "string"
                ? profile.family_name.trim().slice(0, 80)
                : null,
            ),
          db
            .prepare(
              "INSERT INTO google_identities(subject,user_id) VALUES(?,?)",
            )
            .bind(profile.sub, user.id),
        ]);
        db.usage?.event("signup_success", 1, "google");
      } catch {
        user = await db
          .prepare(
            "SELECT users.id,users.email FROM google_identities JOIN users ON users.id=google_identities.user_id WHERE subject=?",
          )
          .bind(profile.sub)
          .first();
        if (!user)
          return finish(request, flow.return_to, "google_account_exists");
      }
    }
    return finish(
      request,
      flow.return_to,
      null,
      await issueSessionCookie(request, db, user),
    );
  } catch {
    return finish(request, flow.return_to, "google_failed");
  }
}
