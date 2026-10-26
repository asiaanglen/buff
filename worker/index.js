import { handleOAuth } from "./oauth.js";
import { identify, sessionToken, cookie } from "./session.js";
import { validState } from "../shared/journal.js";
import {
  authScheme,
  randomHex,
  digest,
  makeVerifier,
  checkVerifier,
} from "./crypto.js";
const MAX_BYTES = 1024 * 1024;
const json = (body, status = 200, headers = {}) =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
      ...headers,
    },
  });
const failure = (error, status) => json({ error }, status);
async function createSession(request, db, user) {
  const token = randomHex();
  await db
    .prepare("INSERT INTO sessions (token,user_id,expires) VALUES (?,?,?)")
    .bind(await digest(token), user.id, Date.now() + 30 * 86400000)
    .run();
  return json({ user, authScheme }, 200, {
    "Set-Cookie": cookie(request, token),
  });
}
async function readBody(request) {
  const reader = request.body?.getReader();
  if (!reader) throw { status: 400, message: "Missing JSON body." };
  let bytes = 0;
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_BYTES) {
      await reader.cancel();
      throw { status: 413, message: "Journal exceeds the 1 MB sync limit." };
    }
    chunks.push(value);
  }
  const data = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(data));
  } catch {
    throw { status: 400, message: "Invalid JSON request." };
  }
}
async function authLimit(request, db) {
  const now = Date.now(),
    window = Math.floor(now / 900000);
  const ip = request.headers.get("CF-Connecting-IP") || "local";
  const bucket = await digest(`${ip}:${window}`);
  const result = await db
    .prepare(
      "INSERT INTO auth_limits (bucket,attempts,expires) VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET attempts=attempts+1 RETURNING attempts",
    )
    .bind(bucket, (window + 1) * 900000)
    .first();
  await db.prepare("DELETE FROM auth_limits WHERE expires<?").bind(now).run();
  return result.attempts <= 30;
}
async function api(request, env) {
  const path = new URL(request.url).pathname,
    method = request.method,
    db = env.DB;
  if (!db) return failure("The workout database is not configured.", 503);
  if (
    !["GET", "HEAD", "OPTIONS"].includes(method) &&
    request.headers.get("Origin") !==
      (env.PUBLIC_ORIGIN || new URL(request.url).origin)
  )
    return failure("Request origin is not allowed.", 403);
  if (path === "/api/health" && method === "GET") {
    const table = await db
      .prepare("SELECT name FROM sqlite_master WHERE name='journals'")
      .first();
    return table
      ? json({ ok: true, storage: "d1" })
      : failure("Database migrations have not been applied.", 503);
  }
  if (path === "/api/auth/session" && method === "GET")
    return json({ user: await identify(request, db), authScheme });
  if (
    ["/api/auth/signup", "/api/auth/signin"].includes(path) &&
    method === "POST"
  ) {
    if (!(await authLimit(request, db)))
      return json(
        { error: "Too many attempts. Try again in 15 minutes." },
        429,
        { "Retry-After": "900" },
      );
    const body = await readBody(request);
    const { email, password, credentialVersion } = body || {};
    if (
      typeof email !== "string" ||
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      credentialVersion !== authScheme ||
      typeof password !== "string" ||
      !/^[a-f0-9]{64}$/.test(password)
    )
      return failure(
        "Enter a valid email and password using the updated Buff app.",
        400,
      );
    const normalized = email.trim().toLowerCase();
    if (path.endsWith("signup")) {
      const salt = randomHex();
      const user = { id: randomHex(16), email: normalized };
      const result = await db
        .prepare(
          "INSERT INTO users (id,email,password,salt) VALUES (?,?,?,?) ON CONFLICT(email) DO NOTHING",
        )
        .bind(user.id, user.email, await makeVerifier(password, salt), salt)
        .run();
      if (!result.meta.changes)
        return failure(
          "Unable to create this account. Try signing in instead.",
          409,
        );
      return createSession(request, db, user);
    }
    const user = await db
      .prepare("SELECT * FROM users WHERE email=?")
      .bind(normalized)
      .first();
    const verified = await checkVerifier(
      password,
      user?.salt || "invalid-account-salt",
      user?.password || "0".repeat(64),
    );
    if (!user || !verified)
      return failure("Email or password is incorrect.", 401);
    return createSession(request, db, { id: user.id, email: user.email });
  }
  if (path === "/api/auth/signout" && method === "POST") {
    const token = sessionToken(request);
    if (token)
      await db
        .prepare("DELETE FROM sessions WHERE token=?")
        .bind(await digest(token))
        .run();
    return json({ ok: true }, 200, { "Set-Cookie": cookie(request, "", true) });
  }
  if (path === "/api/state" && ["GET", "PUT"].includes(method)) {
    const user = await identify(request, db);
    if (!user) return failure("Sign in to sync your workouts.", 401);
    if (method === "GET") {
      const row = await db
        .prepare("SELECT data,revision FROM journals WHERE user_id=?")
        .bind(user.id)
        .first();
      return json(
        row
          ? { revision: row.revision, state: JSON.parse(row.data) }
          : { revision: 0, state: null },
      );
    }
    const { state, revision } = (await readBody(request)) || {};
    if (!Number.isSafeInteger(revision) || revision < 0 || !validState(state))
      return failure("Invalid workout journal.", 400);
    const result =
      revision === 0
        ? await db
            .prepare(
              "INSERT INTO journals (user_id,revision,data) VALUES (?,1,?) ON CONFLICT(user_id) DO NOTHING",
            )
            .bind(user.id, JSON.stringify(state))
            .run()
        : await db
            .prepare(
              "UPDATE journals SET data=?,revision=revision+1 WHERE user_id=? AND revision=?",
            )
            .bind(JSON.stringify(state), user.id, revision)
            .run();
    if (!result.meta.changes)
      return failure(
        "Another device updated your journal. Resolve the conflict before saving.",
        409,
      );
    return json({ revision: revision + 1 });
  }
  return failure("Unknown API endpoint.", 404);
}
const app = {
  async fetch(request, env) {
    if (new URL(request.url).pathname.startsWith("/api/")) {
      try {
        return await api(request, env);
      } catch (e) {
        console.error("Buff API failure", e.name, e.message);
        return failure(
          e.status ? e.message : "The server could not complete this request.",
          e.status || 500,
        );
      }
    }
    return env.ASSETS.fetch(request);
  },
};

export default {
  fetch(request, env, ctx) {
    return handleOAuth(request, env, ctx, app);
  },
};
