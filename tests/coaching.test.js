import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { testD1 } from "./support/d1.js";
import { coachingApi } from "../worker/coaching.js";
import { digest, randomHex } from "../worker/crypto.js";
import { exercise } from "../src/model.js";
import { applyCoachLog } from "../shared/coaching.js";
const origin = "https://buff.test";
async function setup() {
  const db = testD1();
  for (const f of [
    "0001_journal.sql",
    "0005_account_profiles.sql",
    "0007_coaching.sql",
  ])
    db.raw.exec(
      readFileSync(new URL("../migrations/" + f, import.meta.url), "utf8"),
    );
  const users = {};
  for (const name of ["coach", "client", "other", "coach2"]) {
    const token = randomHex(),
      id = randomHex(16);
    db.raw
      .prepare(
        "INSERT INTO users(id,email,password,salt,first_name,last_name,date_of_birth) VALUES(?,?,?,?,?,?,?)",
      )
      .run(
        id,
        name + "@example.test",
        "hash",
        "salt",
        name,
        "Person",
        "1990-01-01",
      );
    db.raw
      .prepare("INSERT INTO sessions(token,user_id,expires) VALUES(?,?,?)")
      .run(await digest(token), id, Date.now() + 3600000);
    users[name] = { id, token };
  }
  const source = {
    version: 1,
    unit: "lbs",
    programs: [
      {
        id: "plan",
        name: "Strength with a coach",
        weeks: 4,
        startDate: "2026-11-02",
        note: "Plan note",
      },
    ],
    workouts: [
      {
        id: "source-workout",
        programId: "plan",
        name: "Strength session",
        date: "2026-11-02",
        note: "",
        exercises: [
          exercise("Back Squat", 2, 5, "reps", 95),
          exercise("Plank", 1, 45, "time"),
        ],
      },
    ],
  };
  source.workouts[0].exercises[0].logs[0] = {
    weight: "175",
    actual: "3",
    done: true,
  };
  source.workouts[0].exercises[0].note = "COACH_PRIVATE_NOTE";
  const privateState = {
    version: 1,
    unit: "lbs",
    activeProgramId: "private",
    programs: [
      {
        id: "private",
        name: "CLIENT_PRIVATE_PROGRAM",
        weeks: 4,
        startDate: "2026-11-02",
        note: "",
      },
    ],
    workouts: [
      {
        id: "private-workout",
        programId: "private",
        name: "CLIENT_PRIVATE_WORKOUT",
        date: "2026-11-02",
        note: "CLIENT_PRIVATE_NOTE",
        exercises: [exercise("Back Squat", 1)],
      },
    ],
  };
  db.raw
    .prepare("INSERT INTO journals(user_id,revision,data) VALUES(?,1,?)")
    .run(users.coach.id, JSON.stringify(source));
  db.raw
    .prepare("INSERT INTO journals(user_id,revision,data) VALUES(?,1,?)")
    .run(users.client.id, JSON.stringify(privateState));
  async function call(actor, path, method = "GET", data, headers = {}) {
    const request = new Request(origin + "/api/coaching" + path, {
      method,
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        ...(actor ? { Cookie: "buff_session=" + users[actor].token } : {}),
        ...headers,
      },
      ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
    });
    const response = await coachingApi(request, { DB: db });
    return {
      status: response.status,
      headers: response.headers,
      body: await response.json(),
    };
  }
  await call("coach", "/profile", "POST", {});
  await call("coach2", "/profile", "POST", {});
  async function invite(email = "") {
    const r = await call("coach", "/invites", "POST", {
      programId: "plan",
      email,
    });
    assert.equal(r.status, 201);
    const token = new URL(r.body.url).hash.slice("#invite=".length);
    return { ...r.body, token };
  }
  return { db, users, source, privateState, call, invite };
}
test("coach signup is self-service; invitations strip coach history, restrict email, expire and are one-use with explicit consent", async () => {
  const { db, users, privateState, call, invite } = await setup();
  assert.equal((await call(null, "")).status, 401);
  assert.equal(
    (await call("client", "/invites", "POST", { programId: "plan" })).status,
    403,
  );
  assert.equal(
    (
      await call(
        "coach",
        "/profile",
        "POST",
        {},
        { Origin: "https://evil.test" },
      )
    ).status,
    403,
  );
  const link = await invite("client@example.test");
  const stored = db.raw
    .prepare("SELECT * FROM coach_invites WHERE id=?")
    .get(link.id);
  assert.notEqual(stored.token_hash, link.token);
  assert.ok(!stored.snapshot.includes("175"));
  assert.ok(!stored.snapshot.includes("COACH_PRIVATE_NOTE"));
  const publicInfo = await call(null, "/invites/" + link.token);
  assert.equal(publicInfo.status, 200);
  assert.ok(!JSON.stringify(publicInfo.body).includes("client@example.test"));
  assert.equal(publicInfo.headers.get("Cache-Control"), "no-store");
  assert.equal(
    (
      await call("client", "/invites/" + link.token + "/accept", "POST", {
        startDate: "2026-11-02",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call("other", "/invites/" + link.token + "/accept", "POST", {
        startDate: "2026-11-02",
        allowCoachLogging: true,
      })
    ).status,
    403,
  );
  const accepted = await call(
    "client",
    "/invites/" + link.token + "/accept",
    "POST",
    { startDate: "2026-11-02", allowCoachLogging: true },
  );
  assert.equal(accepted.status, 201);
  const state = JSON.parse(
    db.raw
      .prepare("SELECT data FROM journals WHERE user_id=?")
      .get(users.client.id).data,
  );
  assert.equal(state.activeProgramId, "private");
  assert.deepEqual(state.workouts[0], privateState.workouts[0]);
  assert.equal(state.programs.length, 2);
  assert.equal(state.programs[1].unenrolled, true);
  assert.ok(
    state.workouts[1].exercises.every((e) =>
      e.logs.every((l) => !l.done && l.weight === "" && l.actual === ""),
    ),
  );
  const replay = await call(
    "client",
    "/invites/" + link.token + "/accept",
    "POST",
    { startDate: "2026-11-02", allowCoachLogging: true },
  );
  assert.equal(replay.body.assignmentId, accepted.body.assignmentId);
  assert.equal(
    db.raw.prepare("SELECT count(*) AS n FROM coaching_assignments").get().n,
    1,
  );
  const another = await invite();
  assert.equal(
    (
      await call("coach", "/invites/" + another.token + "/accept", "POST", {
        startDate: "2026-11-02",
        allowCoachLogging: true,
      })
    ).status,
    400,
  );
  await call("client", "/invites/" + another.token + "/accept", "POST", {
    startDate: "2026-11-02",
    allowCoachLogging: true,
  });
  assert.equal(
    (
      await call("other", "/invites/" + another.token + "/accept", "POST", {
        startDate: "2026-11-02",
        allowCoachLogging: true,
      })
    ).status,
    409,
  );
  const expired = await invite();
  db.raw
    .prepare("UPDATE coach_invites SET expires=0 WHERE id=?")
    .run(expired.id);
  assert.equal((await call(null, "/invites/" + expired.token)).status, 404);
});
test("coach sees only accepted programs, saves reps/time/notes with revision guards, and loses access immediately on client revocation", async () => {
  const { db, users, privateState, call, invite } = await setup();
  const link = await invite();
  const accepted = await call(
    "client",
    "/invites/" + link.token + "/accept",
    "POST",
    { startDate: "2026-11-02", allowCoachLogging: true },
  );
  const id = accepted.body.assignmentId;
  assert.equal((await call("coach2", "/assignments/" + id)).status, 404);
  assert.equal((await call("other", "/access/" + id, "DELETE")).status, 404);
  let detail = await call("coach", "/assignments/" + id);
  assert.equal(detail.status, 200);
  assert.ok(!JSON.stringify(detail.body).includes("CLIENT_PRIVATE"));
  assert.ok(!JSON.stringify(detail.body).includes("1990-01-01"));
  assert.equal(detail.body.workouts.length, 1);
  const workout = detail.body.workouts[0];
  const exercises = workout.exercises.map((e, i) => ({
    id: e.id,
    note: i ? "Held steady" : "CLIENT_COACH_NOTE",
    logs: e.logs.map((l, n) => ({
      weight: i ? "0" : "135",
      actual: i ? "60" : "8",
      done: n === 0,
    })),
  }));
  const payload = { revision: detail.body.revision, exercises };
  assert.equal(
    (
      await call(
        "coach2",
        "/assignments/" + id + "/workouts/" + workout.id,
        "PATCH",
        payload,
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await call(
        "coach",
        "/assignments/" + id + "/workouts/private-workout",
        "PATCH",
        payload,
      )
    ).status,
    400,
  );
  const changed = await call(
    "coach",
    "/assignments/" + id + "/workouts/" + workout.id,
    "PATCH",
    payload,
  );
  assert.equal(changed.status, 200);
  assert.equal(changed.body.progress.setsDone, 2);
  assert.equal(changed.body.workouts[0].exercises[1].logs[0].actual, "60");
  const saved = JSON.parse(
    db.raw
      .prepare("SELECT data FROM journals WHERE user_id=?")
      .get(users.client.id).data,
  );
  assert.deepEqual(saved.workouts[0], privateState.workouts[0]);
  assert.equal(
    db.raw.prepare("SELECT count(*) AS n FROM coaching_log_events").get().n,
    1,
  );
  assert.equal(
    (
      await call(
        "coach",
        "/assignments/" + id + "/workouts/" + workout.id,
        "PATCH",
        payload,
      )
    ).status,
    409,
  );
  assert.equal(
    db.raw.prepare("SELECT count(*) AS n FROM coaching_log_events").get().n,
    1,
  );
  const complete = await call(
    "coach",
    "/assignments/" + id + "/workouts/" + workout.id,
    "PATCH",
    { revision: changed.body.revision, exercises, complete: true },
  );
  assert.equal(complete.body.progress.completed, 1);
  const list = await call("coach", "");
  assert.equal(list.body.assignments[0].completed, 1);
  assert.equal(list.body.assignments[0].sets_done, 3);
  assert.equal((await call("coach2", "")).body.assignments.length, 0);
  assert.equal((await call("client", "/access/" + id, "DELETE")).status, 200);
  assert.equal((await call("coach", "/assignments/" + id)).status, 404);
  assert.equal(
    (
      await call(
        "coach",
        "/assignments/" + id + "/workouts/" + workout.id,
        "PATCH",
        { revision: complete.body.revision, exercises },
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await call("client", "/invites/" + link.token + "/accept", "POST", {
        startDate: "2026-11-02",
        allowCoachLogging: true,
      })
    ).status,
    410,
  );
  const revoked = await call("coach", "");
  assert.equal(revoked.body.assignments[0].sets_done, 0);
  assert.ok(revoked.body.assignments[0].revoked);
  assert.equal(
    JSON.parse(
      db.raw
        .prepare("SELECT data FROM journals WHERE user_id=?")
        .get(users.client.id).data,
    ).programs.length,
    2,
  );
});
test("coach log validation cannot mutate plans or unrelated exercises; a pending invitation can only be disabled by its coach", async () => {
  const { call, invite, source } = await setup();
  const plan = structuredClone(source);
  const e = plan.workouts[0].exercises[0];
  const updated = applyCoachLog(plan, "plan", "source-workout", {
    exercises: [
      {
        id: e.id,
        name: "INJECTED",
        logs: [
          { weight: "", actual: "", done: true },
          { weight: "", actual: "", done: false },
        ],
        note: "Coached",
      },
    ],
  });
  assert.equal(updated.workouts[0].exercises[0].logs[0].weight, 95);
  assert.equal(updated.workouts[0].exercises[0].name, "Back Squat");
  assert.deepEqual(plan, source);
  assert.throws(() =>
    applyCoachLog(plan, "plan", "source-workout", {
      exercises: [{ id: "other-client-exercise", logs: [] }],
    }),
  );
  assert.throws(() =>
    applyCoachLog(plan, "plan", "source-workout", {
      exercises: [
        {
          id: e.id,
          logs: [
            { weight: -1, actual: 2, done: true },
            { weight: 0, actual: 3, done: false },
          ],
        },
      ],
    }),
  );
  const link = await invite();
  assert.equal(
    (await call("coach2", "/invitations/" + link.id, "DELETE")).status,
    404,
  );
  assert.equal(
    (await call("coach", "/invitations/" + link.id, "DELETE")).status,
    200,
  );
  assert.equal((await call(null, "/invites/" + link.token)).status, 404);
});
