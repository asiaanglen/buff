import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { testD1 } from "./support/d1.js";
import { adminPage, adminSummary } from "../worker/admin.js";
import { trackAccountActivity } from "../worker/admin-activity.js";
import { digest, randomHex } from "../worker/crypto.js";
import { exercise } from "../src/model.js";

test("admin timestamps preserve unknown legacy dates, new signups are recorded, activity is throttled, and summaries exclude private journal contents", async () => {
  const db = testD1();
  const files = readdirSync(new URL("../migrations/", import.meta.url))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files.filter((f) => !f.startsWith("0009")))
    db.raw.exec(
      readFileSync(new URL("../migrations/" + file, import.meta.url), "utf8"),
    );
  const addUser = (id, email) =>
    db.raw
      .prepare(
        "INSERT INTO users(id,email,password,salt,first_name,last_name,date_of_birth) VALUES(?,?,?,?,?,?,?)",
      )
      .run(
        id,
        email,
        "PASSWORD_SHOULD_NOT_LEAK",
        "salt",
        "Admin Test",
        "Person",
        "1990-01-01",
      );
  const legacy = randomHex(16);
  addUser(legacy, "legacy@example.test");
  db.raw.exec(
    readFileSync(
      new URL("../migrations/0009_admin_dashboard.sql", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(
    db.raw
      .prepare(
        "SELECT registered_at FROM admin_account_activity WHERE user_id=?",
      )
      .get(legacy).registered_at,
    null,
  );
  const id = randomHex(16);
  addUser(id, "new@example.test");
  assert.ok(
    db.raw
      .prepare(
        "SELECT registered_at FROM admin_account_activity WHERE user_id=?",
      )
      .get(id).registered_at,
  );
  const now = Date.now();
  await trackAccountActivity(db, id, now);
  await trackAccountActivity(db, id, now + 1000);
  assert.equal(
    db.raw
      .prepare(
        "SELECT last_active_at FROM admin_account_activity WHERE user_id=?",
      )
      .get(id).last_active_at,
    now,
  );
  await trackAccountActivity(db, id, now + 360000);
  assert.equal(
    db.raw
      .prepare(
        "SELECT last_active_at FROM admin_account_activity WHERE user_id=?",
      )
      .get(id).last_active_at,
    now + 360000,
  );
  const e = exercise("PRIVATE_MOVEMENT", 1);
  e.logs = [{ weight: 10, actual: 8, done: true }];
  e.note = "PRIVATE_SESSION_NOTE";
  db.raw
    .prepare("INSERT INTO journals(user_id,revision,data) VALUES(?,1,?)")
    .run(
      id,
      JSON.stringify({
        version: 1,
        unit: "lbs",
        programs: [],
        workouts: [
          {
            id: "w",
            name: "PRIVATE_WORKOUT",
            date: "2026-10-29",
            note: "PRIVATE_NOTE",
            exercises: [e],
          },
        ],
      }),
    );
  db.raw
    .prepare("INSERT INTO coach_profiles(user_id,created) VALUES(?,?)")
    .run(id, now);
  const summary = await adminSummary(db, { now: now + 360001 });
  assert.equal(summary.totals.accounts, 2);
  assert.equal(summary.totals.coaches, 1);
  assert.equal(summary.totals.completedWorkouts, 1);
  assert.equal(summary.totals.active24h, 1);
  assert.ok(!JSON.stringify(summary).includes("PRIVATE_"));
  assert.ok(!JSON.stringify(summary).includes("PASSWORD_SHOULD_NOT_LEAK"));
  assert.ok(!JSON.stringify(summary).includes("1990-01-01"));
  assert.equal(
    (await adminSummary(db, { query: "new@example.test" })).totalUsers,
    1,
  );
  assert.equal((await adminSummary(db, { query: "%" })).totalUsers, 0);
  assert.equal(
    (await adminSummary(db, { query: "' OR 1=1 --" })).totalUsers,
    0,
  );
  const token = randomHex();
  db.raw
    .prepare("INSERT INTO sessions(token,user_id,expires) VALUES(?,?,?)")
    .run(await digest(token), id, now + 3600000);
  const req = (cookie, path = "/admin") =>
    new Request("https://buff.test" + path, {
      headers: cookie ? { Cookie: "buff_session=" + token } : {},
    });
  assert.equal((await adminPage(req(false), { DB: db })).status, 303);
  assert.equal(
    (await adminPage(req(false, "/api/admin/dashboard"), { DB: db }, true))
      .status,
    401,
  );
  assert.equal((await adminPage(req(true), { DB: db })).status, 403);
  assert.equal(
    (await adminPage(req(true, "/api/admin/dashboard"), { DB: db }, true))
      .status,
    403,
  );
  db.raw.prepare("INSERT INTO usage_owners(user_id) VALUES(?)").run(id);
  const response = await adminPage(req(true), { DB: db });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  const html = await response.text();
  assert.ok(html.includes("new@example.test"));
  assert.ok(html.includes("Not recorded"));
  assert.ok(!html.includes("PRIVATE_WORKOUT"));
  await trackAccountActivity(
    {
      prepare() {
        throw Error("database temporarily unavailable");
      },
    },
    randomHex(16),
    now,
  );
});
