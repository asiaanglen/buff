import { adminPage } from "./admin.js";
import { feedbackPage } from "./feedback.js";
import { coachingApi } from "./coaching.js";
import { usageSetup } from "./usage-setup.js";
import {
  monitoredDatabase,
  ownerUser,
  journalCompleted,
  reportSyncFailure,
} from "./usage.js";
import { usagePage } from "./usage-page.js";
import { profileError, accountUser } from "../shared/account-profile.js";
import { sharingApi } from "./sharing.js";
import { handleGoogle, googleConfigured } from "./google.js";
import { inPounds } from "../shared/weights.js";
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
  db.usage?.actor(user.id);
  return json({ user: await ownerUser(db, user), authScheme }, 200, {
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
  if (path === "/api/admin/dashboard") return adminPage(request, env, true);
  if (path === "/api/admin/usage" && method === "GET")
    return usagePage(request, env, true);
  if (path === "/api/usage/events" && method === "POST")
    return reportSyncFailure(request, env);
  if (path.startsWith("/api/coaching")) return coachingApi(request, env);
  if (path.startsWith("/api/program-shares")) return sharingApi(request, env);
  if (path === "/api/auth/providers" && method === "GET") {
    const enabled = googleConfigured(env),
      user = enabled ? await identify(request, db) : null;
    const linked = user
      ? Boolean(
          await db
            .prepare("SELECT subject FROM google_identities WHERE user_id=?")
            .bind(user.id)
            .first(),
        )
      : false;
    return json({ google: enabled, googleLinked: linked });
  }
  if (path.startsWith("/api/auth/google/")) {
    if (path.endsWith("/start") || path.endsWith("/link"))
      if (!(await authLimit(request, db)))
        return failure("Too many sign-in attempts. Try again later.", 429);
    return handleGoogle(request, env);
  }
  if (path === "/api/health" && method === "GET") {
    const table = await db
      .prepare("SELECT name FROM sqlite_master WHERE name='journals'")
      .first();
    return table
      ? json({ ok: true, storage: "d1" })
      : failure("Database migrations have not been applied.", 503);
  }
  if (path === "/api/auth/session" && method === "GET")
    return json({
      user: await ownerUser(db, await identify(request, db)),
      authScheme,
    });
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
      const error = profileError(body);
      if (error) return failure(error, 400);
      const salt = randomHex();
      const user = {
        id: randomHex(16),
        email: normalized,
        passwordEnabled: true,
        firstName: body.firstName.trim(),
        lastName: body.lastName.trim(),
        dateOfBirth: body.dateOfBirth,
      };
      const result = await db
        .prepare(
          "INSERT INTO users (id,email,password,salt,first_name,last_name,date_of_birth) VALUES (?,?,?,?,?,?,?) ON CONFLICT(email) DO NOTHING",
        )
        .bind(
          user.id,
          user.email,
          await makeVerifier(password, salt),
          salt,
          user.firstName,
          user.lastName,
          user.dateOfBirth,
        )
        .run();
      if (!result.meta.changes)
        return failure(
          "Unable to create this account. Try signing in instead.",
          409,
        );
      db.usage?.event("signup_success");
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
    db.usage?.event("signin_success");
    return createSession(request, db, accountUser(user));
  }
  if (path === "/api/auth/profile" && method === "POST") {
    const user = await identify(request, db);
    if (!user) return failure("Sign in to save your profile.", 401);
    const body = await readBody(request);
    const error = profileError(body);
    if (error) return failure(error, 400);
    const email =
      body.email === undefined
        ? user.email
        : typeof body.email === "string"
          ? body.email.trim().toLowerCase()
          : "";
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return failure("Enter a valid email address.", 400);
    const credentialChange =
      email !== user.email ||
      (body.newPassword !== undefined && body.newPassword !== "");
    if (credentialChange) {
      if (!(await authLimit(request, db)))
        return failure("Too many attempts. Try again in 15 minutes.", 429);
      if (
        body.credentialVersion !== authScheme ||
        typeof body.currentPassword !== "string" ||
        !/^[a-f0-9]{64}$/.test(body.currentPassword) ||
        typeof body.newPassword !== "string" ||
        !/^[a-f0-9]{64}$/.test(body.newPassword)
      )
        return failure(
          "Enter your current password to change your email or password.",
          400,
        );
      const row = await db
        .prepare("SELECT * FROM users WHERE id=?")
        .bind(user.id)
        .first();
      if (
        !row ||
        !(await checkVerifier(body.currentPassword, row.salt, row.password))
      )
        return failure("Your current password is incorrect.", 401);
      const salt = randomHex();
      const password = await makeVerifier(body.newPassword, salt);
      try {
        const results = await db.batch([
          db
            .prepare(
              "UPDATE users SET first_name=?,last_name=?,date_of_birth=?,profile_required=0,email=?,password=?,salt=? WHERE id=? AND password=? AND email=?",
            )
            .bind(
              body.firstName.trim(),
              body.lastName.trim(),
              body.dateOfBirth,
              email,
              password,
              salt,
              user.id,
              row.password,
              user.email,
            ),
          db
            .prepare(
              "DELETE FROM sessions WHERE user_id=? AND token<>? AND EXISTS (SELECT 1 FROM users WHERE id=? AND password=?)",
            )
            .bind(
              user.id,
              await digest(sessionToken(request)),
              user.id,
              password,
            ),
        ]);
        if (!results[0].meta.changes)
          return failure(
            "Your account changed on another device. Reload and try again.",
            409,
          );
      } catch (error) {
        if (
          String(error.message).includes(
            "UNIQUE constraint failed: users.email",
          )
        )
          return failure(
            "That email is already in use. Choose another email address.",
            409,
          );
        throw error;
      }
    } else {
      await db
        .prepare(
          "UPDATE users SET first_name=?,last_name=?,date_of_birth=?,profile_required=0 WHERE id=?",
        )
        .bind(
          body.firstName.trim(),
          body.lastName.trim(),
          body.dateOfBirth,
          user.id,
        )
        .run();
    }
    return json({ user: await ownerUser(db, await identify(request, db)) });
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
          ? { revision: row.revision, state: inPounds(JSON.parse(row.data)) }
          : { revision: 0, state: null },
      );
    }
    const { state, revision } = (await readBody(request)) || {};
    if (!Number.isSafeInteger(revision) || revision < 0 || !validState(state))
      return failure("Invalid workout journal.", 400);
    const previous = await db
      .prepare("SELECT data FROM journals WHERE user_id=? AND revision=?")
      .bind(user.id, revision)
      .first();
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
    if (revision > 0) journalCompleted(db, previous?.data || null, state);
    return json({ revision: revision + 1 });
  }
  return failure("Unknown API endpoint.", 404);
}
const app = {
  async fetch(request, env) {
    if (new URL(request.url).pathname === "/admin")
      return adminPage(request, env);
    if (
      ["/feedback", "/feedback/inbox", "/feedback/thanks"].includes(
        new URL(request.url).pathname,
      )
    )
      return feedbackPage(request, env);
    if (new URL(request.url).pathname === "/usage/setup")
      return usageSetup(request, env);
    if (new URL(request.url).pathname === "/usage")
      return usagePage(request, env);
    if (new URL(request.url).pathname.startsWith("/api/")) {
      try {
        return await api(request, env);
      } catch (e) {
        console.error("buff_api_failure", e.status || 500);
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
  async fetch(request, env, ctx) {
    if (!env.DB) return handleOAuth(request, env, ctx, app);
    const monitoring = monitoredDatabase(env.DB, env, request);
    let response;
    try {
      response = await handleOAuth(
        request,
        { ...env, DB: monitoring.db },
        ctx,
        app,
      );
    } catch {
      response = failure("The server could not complete this request.", 500);
    }
    ctx.waitUntil(
      monitoring
        .finish(response)
        .catch(() => console.warn("usage_metrics_unavailable")),
    );
    return response;
  },
};
