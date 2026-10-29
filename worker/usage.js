import { trackAccountActivity } from "./admin-activity.js";
import { identify } from "./session.js";
const actors = new Map();
let lastCleanup = "";
const allowedEvents = new Set([
  "signup_success",
  "signup_failure",
  "signin_success",
  "signin_failure",
  "workout_completed",
  "sync_failed",
  "sync_network_failure",
  "server_error",
]);
const categoryFor = (path) =>
  path === "/api/auth/signup"
    ? "signup"
    : path === "/api/auth/signin"
      ? "signin"
      : path.startsWith("/api/auth/google/")
        ? "google"
        : path === "/api/state"
          ? "sync"
          : path.startsWith("/mcp")
            ? "mcp"
            : path.startsWith("/oauth/")
              ? "oauth"
              : path.startsWith("/api/program-shares")
                ? "sharing"
                : "other";
export async function usageOwner(db, userId) {
  return Boolean(
    userId &&
    (await db
      .prepare("SELECT user_id FROM usage_owners WHERE user_id=?")
      .bind(userId)
      .first()),
  );
}
export async function ownerUser(db, user) {
  if (!user) return null;
  const { isUsageOwner, ...publicUser } = user;
  try {
    return (await usageOwner(db, user.id))
      ? { ...publicUser, isUsageOwner: true }
      : publicUser;
  } catch {
    console.warn("usage_access_unavailable");
    return publicUser;
  }
}
async function privateHash(key, value) {
  const encoder = new TextEncoder();
  const secret = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const bytes = await crypto.subtle.sign("HMAC", secret, encoder.encode(value));
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
function completions(state) {
  return new Set(
    (state?.workouts || [])
      .filter(
        (workout) =>
          workout.exercises.length &&
          workout.exercises.every(
            (exercise) =>
              exercise.logs.length && exercise.logs.every((log) => log.done),
          ),
      )
      .map((workout) => workout.id),
  );
}
export function journalCompleted(db, previous, next) {
  if (!db.usage) return;
  try {
    const before = completions(
      typeof previous === "string" ? JSON.parse(previous) : previous,
    );
    const after = completions(
      typeof next === "string" ? JSON.parse(next) : next,
    );
    db.usage.event(
      "workout_completed",
      [...after].filter((id) => !before.has(id)).length,
    );
  } catch {
    console.warn("usage_completion_unavailable");
  }
}
export function monitoredDatabase(
  db,
  env,
  request,
  { random = Math.random, now = Date.now } = {},
) {
  const path = new URL(request.url).pathname;
  const excluded =
    path.startsWith("/api/admin/") ||
    path.startsWith("/usage") ||
    path === "/admin" ||
    path === "/api/health";
  const rate = Math.max(
    0.01,
    Math.min(1, Number(env.USAGE_SAMPLE_RATE) || 0.05),
  );
  const sampled = !excluded && random() < rate;
  const started = now();
  let actor = null,
    reads = 0,
    writes = 0;
  const events = new Map();
  const usage = {
    actor(id) {
      if (!excluded) actor = id;
    },
    event(event, count = 1, category = categoryFor(path), status = 200) {
      if (
        excluded ||
        !allowedEvents.has(event) ||
        !Number.isSafeInteger(count) ||
        count <= 0
      )
        return;
      const key = JSON.stringify([event, category, status]);
      events.set(key, (events.get(key) || 0) + count);
    },
  };
  function meta(result) {
    reads += Number(result?.meta?.rows_read) || 0;
    writes += Number(result?.meta?.rows_written) || 0;
    return result;
  }
  const originals = new WeakMap();
  function statement(raw) {
    const wrapped = {
      bind(...args) {
        return statement(raw.bind(...args));
      },
      async all(...args) {
        return meta(await raw.all(...args));
      },
      async run(...args) {
        return meta(await raw.run(...args));
      },
      async first(column) {
        const result = meta(await raw.all());
        const row = result.results?.[0] || null;
        return column === undefined ? row : (row?.[column] ?? null);
      },
      raw(...args) {
        return raw.raw(...args);
      },
    };
    originals.set(wrapped, raw);
    return wrapped;
  }
  const wrapped = {
    usage,
    prepare(sql) {
      return statement(db.prepare(sql));
    },
    async batch(statements) {
      const results = await db.batch(
        statements.map((value) => originals.get(value) || value),
      );
      results.forEach(meta);
      return results;
    },
    exec: (...args) => db.exec(...args),
  };
  async function finish(response) {
    if (actor) await trackAccountActivity(db, actor, now());
    if (excluded) return;
    const status = response?.status || 500;
    if (status >= 500)
      usage.event("server_error", 1, categoryFor(path), status);
    if (status >= 400 && path === "/api/auth/signup")
      usage.event("signup_failure", 1, "signup", status);
    if (status >= 400 && path === "/api/auth/signin")
      usage.event("signin_failure", 1, "signin", status);
    if (status >= 400 && path === "/api/state")
      usage.event("sync_failed", 1, "sync", status);
    if (
      path === "/api/auth/google/callback" &&
      response?.headers.get("Location")?.includes("auth_error=")
    )
      usage.event("signin_failure", 1, "google", 400);
    const time = now(),
      day = new Date(time).toISOString().slice(0, 10),
      hour = new Date(time).toISOString().slice(0, 13) + ":00:00Z";
    const statements = [];
    if (sampled)
      statements.push(
        db
          .prepare(
            "INSERT INTO usage_hourly(hour,samples,requests_estimate,reads_estimate,writes_estimate,response_ms_estimate) VALUES(?,1,?,?,?,?) ON CONFLICT(hour) DO UPDATE SET samples=samples+1,requests_estimate=requests_estimate+excluded.requests_estimate,reads_estimate=reads_estimate+excluded.reads_estimate,writes_estimate=writes_estimate+excluded.writes_estimate,response_ms_estimate=response_ms_estimate+excluded.response_ms_estimate",
          )
          .bind(
            hour,
            1 / rate,
            reads / rate,
            writes / rate,
            (time - started) / rate,
          ),
      );
    for (const [key, count] of events) {
      const [event, category, status] = JSON.parse(key);
      statements.push(
        db
          .prepare(
            "INSERT INTO usage_events(hour,event,category,status,count) VALUES(?,?,?,?,?) ON CONFLICT(hour,event,category,status) DO UPDATE SET count=count+excluded.count",
          )
          .bind(hour, event, category, status, count),
      );
    }
    const actorKey = actor && env.USAGE_METRICS_KEY ? day + "/" + actor : null;
    if (actorKey && !actors.has(actorKey)) {
      const hash = await privateHash(
        env.USAGE_METRICS_KEY,
        "active/" + actorKey,
      );
      statements.push(
        db
          .prepare(
            "INSERT OR IGNORE INTO usage_active_days(day,visitor_hash) VALUES(?,?)",
          )
          .bind(day, hash),
      );
    }
    const cleanup = sampled && lastCleanup !== hour;
    if (cleanup) {
      const cutoff = new Date(time - 30 * 86400000).toISOString().slice(0, 10);
      statements.push(
        db
          .prepare(
            "DELETE FROM usage_hourly WHERE hour IN (SELECT hour FROM usage_hourly WHERE hour<? LIMIT 1000)",
          )
          .bind(cutoff),
      );
      statements.push(
        db
          .prepare(
            "DELETE FROM usage_events WHERE (hour,event,category,status) IN (SELECT hour,event,category,status FROM usage_events WHERE hour<? LIMIT 1000)",
          )
          .bind(cutoff),
      );
      statements.push(
        db
          .prepare(
            "DELETE FROM usage_active_days WHERE (day,visitor_hash) IN (SELECT day,visitor_hash FROM usage_active_days WHERE day<? LIMIT 1000)",
          )
          .bind(cutoff),
      );
      statements.push(
        db
          .prepare(
            "DELETE FROM usage_client_reports WHERE report_hash IN (SELECT report_hash FROM usage_client_reports WHERE day<? LIMIT 1000)",
          )
          .bind(cutoff),
      );
    }
    if (!statements.length) return;
    try {
      await db.batch(statements);
      if (actorKey) {
        actors.set(actorKey, true);
        if (actors.size > 5000) actors.delete(actors.keys().next().value);
      }
      if (cleanup) lastCleanup = hour;
    } catch {
      console.warn("usage_metrics_unavailable");
    }
  }
  return { db: wrapped, finish };
}
export async function readSmallUsageBody(request, limit = 1024) {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let size = 0,
    text = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}
export async function reportSyncFailure(request, env) {
  const user = await identify(request, env.DB);
  if (!user)
    return Response.json(
      { error: "Sign in to report a sync issue." },
      { status: 401 },
    );
  if (!env.USAGE_METRICS_KEY)
    return Response.json(
      { error: "Monitoring is unavailable." },
      { status: 503 },
    );
  const text = await readSmallUsageBody(request);
  if (text === null)
    return Response.json({ error: "Report is too large." }, { status: 413 });
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: "Invalid report." }, { status: 400 });
  }
  if (
    !body ||
    Object.keys(body).some((key) => !["event", "id"].includes(key)) ||
    body.event !== "sync_network_failure" ||
    typeof body.id !== "string" ||
    !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(body.id)
  )
    return Response.json({ error: "Invalid report." }, { status: 400 });
  const hash = await privateHash(
      env.USAGE_METRICS_KEY,
      "report/" + user.id + "/" + body.id,
    ),
    day = new Date().toISOString().slice(0, 10);
  const visitor = await privateHash(
    env.USAGE_METRICS_KEY,
    "active/" + day + "/" + user.id,
  );
  const inserted = await env.DB.prepare(
    "INSERT OR IGNORE INTO usage_client_reports(report_hash,day,visitor_hash) SELECT ?,?,? WHERE (SELECT COUNT(*) FROM usage_client_reports WHERE day=? AND visitor_hash=?)<20",
  )
    .bind(hash, day, visitor, day, visitor)
    .run();
  if (inserted.meta.changes)
    env.DB.usage?.event("sync_network_failure", 1, "sync", 0);
  return Response.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function usageSummary(db, days = 7, now = Date.now()) {
  const day = new Date(now).toISOString().slice(0, 10),
    since = new Date(now - (days - 1) * 86400000).toISOString().slice(0, 10);
  const results = await db.batch([
    db.prepare("SELECT started_at FROM usage_settings WHERE id=1"),
    db.prepare("SELECT COUNT(*) AS users FROM users"),
    db.prepare(
      "SELECT COUNT(*) AS journals,COALESCE(MAX(length(CAST(data AS BLOB))),0) AS largest_journal,COALESCE(SUM(CASE WHEN length(CAST(data AS BLOB))>=768000 THEN 1 ELSE 0 END),0) AS near_limit FROM journals",
    ),
    db
      .prepare(
        "SELECT COALESCE(SUM(requests_estimate),0) AS requests,COALESCE(SUM(reads_estimate),0) AS reads,COALESCE(SUM(writes_estimate),0) AS writes,COALESCE(SUM(samples),0) AS samples FROM usage_hourly WHERE hour>=?",
      )
      .bind(day),
    db
      .prepare(
        "SELECT day,COUNT(*) AS active_users FROM usage_active_days WHERE day>=? GROUP BY day ORDER BY day DESC",
      )
      .bind(since),
    db
      .prepare(
        "SELECT substr(hour,1,10) AS day,event,SUM(count) AS count FROM usage_events WHERE hour>=? GROUP BY day,event ORDER BY day DESC",
      )
      .bind(since),
    db
      .prepare(
        "SELECT hour,event,category,status,count FROM usage_events WHERE event IN ('signup_failure','signin_failure','sync_failed','sync_network_failure','server_error') AND hour>=? ORDER BY hour DESC LIMIT 20",
      )
      .bind(since),
  ]);
  return {
    day,
    days,
    startedAt: results[0].results[0]?.started_at || now,
    registeredUsers: results[1].results[0]?.users || 0,
    journals: results[2].results[0],
    databaseBytes:
      results.find((result) => Number.isFinite(result.meta?.size_after))?.meta
        .size_after ?? null,
    estimates: results[3].results[0],
    activity: results[4].results,
    events: results[5].results,
    errors: results[6].results,
    limits: {
      requests: 100000,
      reads: 5000000,
      writes: 100000,
      databaseBytes: 500000000,
      journalWarning: 768000,
      journalMax: 1048576,
    },
    sampleRate: 0.05,
  };
}
