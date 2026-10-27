import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { testD1 } from "./support/d1.js";
import {
  monitoredDatabase,
  journalCompleted,
  usageOwner,
  ownerUser,
  usageSummary,
} from "../worker/usage.js";
import { quotaWarnings } from "../worker/usage-page.js";
const now = Date.parse("2026-11-04T12:00:00Z");
function setup() {
  const db = testD1();
  for (const file of [
    "0001_journal.sql",
    "0005_account_profiles.sql",
    "0006_usage_monitoring.sql",
  ])
    db.raw.exec(
      readFileSync(new URL("../migrations/" + file, import.meta.url), "utf8"),
    );
  db.raw
    .prepare(
      "INSERT INTO users(id,email,password,salt,first_name,last_name,date_of_birth) VALUES(?,?,?,?,?,?,?)",
    )
    .run(
      crypto.randomUUID(),
      "PRIVATE_EMAIL@example.com",
      "hash",
      "salt",
      "PRIVATE_NAME",
      "PRIVATE_LAST",
      "1990-03-22",
    );
  const id = db.raw.prepare("SELECT id FROM users").get().id;
  return { db, id };
}
test("sampled traffic and aggregated events keep private data out of monitoring and deduplicate daily activity", async () => {
  const { db, id } = setup();
  try {
    const env = {
      USAGE_METRICS_KEY: "unit-private-key",
      USAGE_SAMPLE_RATE: "0.05",
    };
    const first = monitoredDatabase(
      db,
      env,
      new Request("https://buff.test/api/state?PRIVATE_URL=true"),
      { now: () => now, random: () => 0 },
    );
    first.db.usage.actor(id);
    first.db.usage.event("signup_success");
    await first.db
      .prepare("SELECT email FROM users WHERE id=?")
      .bind(id)
      .first();
    journalCompleted(
      first.db,
      {
        workouts: [
          { id: "PRIVATE_WORKOUT", exercises: [{ logs: [{ done: false }] }] },
        ],
      },
      {
        workouts: [
          {
            id: "PRIVATE_WORKOUT",
            name: "PRIVATE_WORKOUT_NAME",
            note: "PRIVATE_NOTE",
            exercises: [{ logs: [{ done: true }] }],
          },
        ],
      },
    );
    await first.finish(new Response("PRIVATE_BODY"));
    const second = monitoredDatabase(
      db,
      env,
      new Request("https://buff.test/api/state"),
      { now: () => now, random: () => 1 },
    );
    second.db.usage.actor(id);
    await second.finish(new Response(null, { status: 409 }));
    const summary = await usageSummary(db, 7, now);
    assert.equal(summary.estimates.requests, 20);
    assert.equal(summary.estimates.reads, 20);
    assert.equal(summary.activity[0].active_users, 1);
    assert.equal(
      summary.events.find((row) => row.event === "signup_success").count,
      1,
    );
    assert.equal(
      summary.events.find((row) => row.event === "workout_completed").count,
      1,
    );
    assert.equal(
      summary.events.find((row) => row.event === "sync_failed").count,
      1,
    );
    const stored = JSON.stringify([
      db.raw.prepare("SELECT * FROM usage_hourly").all(),
      db.raw.prepare("SELECT * FROM usage_events").all(),
      db.raw.prepare("SELECT * FROM usage_active_days").all(),
      summary,
    ]);
    for (const value of [
      id,
      "PRIVATE_EMAIL",
      "PRIVATE_NAME",
      "PRIVATE_LAST",
      "PRIVATE_WORKOUT",
      "PRIVATE_NOTE",
      "1990-03-22",
      "PRIVATE_BODY",
      "PRIVATE_URL",
    ])
      assert.equal(stored.includes(value), false);
    assert.match(
      db.raw.prepare("SELECT visitor_hash FROM usage_active_days").get()
        .visitor_hash,
      /^[a-f0-9]{64}$/,
    );
  } finally {
    db.raw.close();
  }
});
test("owner access uses an explicit account ID, survives email edits, and is not granted to the first user", async () => {
  const { db, id } = setup();
  try {
    assert.equal(await usageOwner(db, id), false);
    assert.deepEqual(
      await ownerUser(db, {
        id,
        email: "original@example.com",
        isUsageOwner: true,
      }),
      { id, email: "original@example.com" },
    );
    db.raw.prepare("INSERT INTO usage_owners VALUES(?)").run(id);
    db.raw
      .prepare("UPDATE users SET email=? WHERE id=?")
      .run("new@example.com", id);
    assert.equal(
      (await ownerUser(db, { id, email: "new@example.com" })).isUsageOwner,
      true,
    );
    assert.equal(await usageOwner(db, "someone-else"), false);
    db.raw.exec("DROP TABLE usage_owners");
    assert.deepEqual(await ownerUser(db, { id, email: "new@example.com" }), {
      id,
      email: "new@example.com",
    });
  } finally {
    db.raw.close();
  }
});
test("monitoring failure does not turn a successful workout response into a failure", async () => {
  const { db, id } = setup();
  const monitor = monitoredDatabase(
    db,
    { USAGE_METRICS_KEY: "test", USAGE_SAMPLE_RATE: "1" },
    new Request("https://buff.test/api/state"),
    { now: () => now + 3600000, random: () => 0 },
  );
  monitor.db.usage.actor(id);
  db.raw.exec("DROP TABLE usage_hourly");
  // A missing monitoring table rejects inside flush; the caller catches this best-effort promise.
  await monitor.finish(new Response(null, { status: 200 })).catch(() => {});
  db.raw.close();
});
test("quota warnings distinguish the 70% and 90% thresholds without inventing missing storage values", () => {
  const summary = {
    estimates: { requests: 90000, reads: 3500000, writes: 100 },
    limits: {
      requests: 100000,
      reads: 5000000,
      writes: 100000,
      databaseBytes: 500000000,
    },
    databaseBytes: null,
  };
  assert.deepEqual(
    quotaWarnings(summary).map(({ level, percent }) => ({ level, percent })),
    [
      { level: "critical", percent: 90 },
      { level: "warning", percent: 70 },
    ],
  );
});

test("private owner setup needs a valid unexpired one-time token and never grants another account access", async () => {
  const { usageSetup } = await import("../worker/usage-setup.js");
  const { issueSessionCookie } = await import("../worker/session.js");
  const { digest } = await import("../worker/crypto.js");
  const { db, id } = setup();
  try {
    const origin = "https://buff.test",
      token = "a".repeat(64),
      secondId = crypto.randomUUID();
    db.raw
      .prepare("INSERT INTO users(id,email,password,salt) VALUES(?,?,?,?)")
      .run(secondId, "other@example.com", "hash", "salt");
    const cookie = (
      await issueSessionCookie(new Request(origin), db, { id })
    ).split(";")[0];
    const secondCookie = (
      await issueSessionCookie(new Request(origin), db, { id: secondId })
    ).split(";")[0];
    db.raw
      .prepare("INSERT INTO usage_setup(token_hash,expires) VALUES(?,?)")
      .run(await digest(token), Date.now() + 60000);
    const call = (body, suppliedCookie = cookie, suppliedOrigin = origin) =>
      usageSetup(
        new Request(origin + "/usage/setup", {
          method: "POST",
          headers: {
            Origin: suppliedOrigin,
            Cookie: suppliedCookie,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body,
        }),
        { DB: db },
      );
    assert.equal((await call("setupToken=" + "b".repeat(64))).status, 410);
    assert.equal(await usageOwner(db, id), false);
    assert.equal(
      (await call("setupToken=" + token, cookie, "https://other.example"))
        .status,
      403,
    );
    db.raw.prepare("UPDATE usage_setup SET expires=?").run(Date.now() - 1);
    assert.equal((await call("setupToken=" + token)).status, 410);
    db.raw.prepare("UPDATE usage_setup SET expires=?").run(Date.now() + 60000);
    assert.equal((await call("setupToken=" + token)).status, 303);
    assert.equal(await usageOwner(db, id), true);
    assert.equal(
      db.raw.prepare("SELECT COUNT(*) AS n FROM usage_setup").get().n,
      0,
    );
    assert.equal((await call("setupToken=" + token, secondCookie)).status, 403);
    assert.equal(await usageOwner(db, secondId), false);
  } finally {
    db.raw.close();
  }
});

test("monitoring and owner setup bodies are bounded before parsing", async () => {
  const { readSmallUsageBody } = await import("../worker/usage.js");
  assert.equal(
    await readSmallUsageBody(
      new Request("https://buff.test", {
        method: "POST",
        body: "x".repeat(2048),
      }),
    ),
    null,
  );
  assert.equal(
    await readSmallUsageBody(
      new Request("https://buff.test", {
        method: "POST",
        body: '{"event":"sync_network_failure"}',
      }),
    ),
    '{"event":"sync_network_failure"}',
  );
});

test("completion telemetry cannot turn a committed journal update into a failure", () => {
  let recorded = false;
  const db = {
    usage: {
      event() {
        recorded = true;
      },
    },
  };
  assert.doesNotThrow(() =>
    journalCompleted(db, "invalid legacy JSON", { workouts: [] }),
  );
  assert.equal(recorded, false);
});
