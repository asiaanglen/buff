import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/app.js";
import { initialState } from "../src/model.js";
test("accounts isolate journals, durable revisions prevent lost updates, and sessions can be revoked", async () => {
  const { app, close } = createApp({ databasePath: ":memory:" });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  async function req(path, method = "GET", body, cookie = "", origin = base) {
    return fetch(base + "/api" + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
        Cookie: cookie,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  }
  try {
    assert.equal((await req("/state")).status, 401);
    assert.equal(
      (
        await req("/auth/signup", "POST", {
          email: "a@example.com",
          password: "short",
        })
      ).status,
      400,
    );
    const a = await req("/auth/signup", "POST", {
      email: "a@example.com",
      password: "a long safe password",
    });
    assert.equal(a.status, 200);
    const cookie = a.headers.get("set-cookie").split(";")[0];
    assert.match(a.headers.get("set-cookie"), /HttpOnly/);
    assert.match(a.headers.get("set-cookie"), /SameSite=Lax/);
    const journal = initialState();
    let result = await req(
      "/state",
      "PUT",
      { state: journal, revision: 0 },
      cookie,
    );
    assert.equal(result.status, 200);
    assert.equal((await result.json()).revision, 1);
    assert.equal(
      (await req("/state", "PUT", { state: journal, revision: 0 }, cookie))
        .status,
      409,
    );
    const b = await req("/auth/signup", "POST", {
      email: "b@example.com",
      password: "another long password",
    });
    const cookieB = b.headers.get("set-cookie").split(";")[0];
    assert.equal(
      (await (await req("/state", "GET", null, cookieB)).json()).state,
      null,
    );
    assert.equal(
      (
        await req(
          "/state",
          "PUT",
          { state: journal, revision: 1 },
          cookie,
          "https://evil.example",
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await req(
          "/state",
          "PUT",
          { state: { version: 1, unit: "kg", workouts: [{}] }, revision: 1 },
          cookie,
        )
      ).status,
      400,
    );
    const signIn = await req("/auth/signin", "POST", {
      email: "A@example.com",
      password: "a long safe password",
    });
    assert.equal(signIn.status, 200);
    const second = signIn.headers.get("set-cookie").split(";")[0];
    assert.deepEqual(
      (await (await req("/state", "GET", null, second)).json()).state,
      journal,
    );
    assert.equal(
      (
        await req("/auth/signin", "POST", {
          email: "a@example.com",
          password: "wrong password",
        })
      ).status,
      401,
    );
    await req("/auth/signout", "POST", {}, cookie);
    assert.equal((await req("/state", "GET", null, cookie)).status, 401);
    assert.equal((await req("/state", "GET", null, second)).status, 200);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    close();
  }
});

test("workout history and account sessions survive a database reopen", async () => {
  const { mkdtempSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const folder = mkdtempSync(join(tmpdir(), "buff-durable-"));
  const databasePath = join(folder, "journal.sqlite");
  let instance, server;
  async function start() {
    instance = createApp({ databasePath });
    server = instance.app.listen(0, "127.0.0.1");
    await new Promise((r) => server.once("listening", r));
    return `http://127.0.0.1:${server.address().port}`;
  }
  async function stop() {
    await new Promise((r) => server.close(r));
    instance.close();
    server = null;
  }
  try {
    let base = await start();
    const auth = await fetch(base + "/api/auth/signup", {
      method: "POST",
      headers: { Origin: base, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "durable@example.com",
        password: "a persistent password",
      }),
    });
    assert.equal(auth.status, 200);
    const cookie = auth.headers.get("set-cookie").split(";")[0];
    const state = initialState();
    state.workouts[0].exercises[0].logs[0] = {
      weight: "40",
      actual: "8",
      done: true,
    };
    const saved = await fetch(base + "/api/state", {
      method: "PUT",
      headers: {
        Origin: base,
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({ state, revision: 0 }),
    });
    assert.equal(saved.status, 200);
    await stop();
    base = await start();
    const restored = await fetch(base + "/api/state", {
      headers: { Cookie: cookie },
    });
    assert.equal(restored.status, 200);
    assert.deepEqual(await restored.json(), { state, revision: 1 });
  } finally {
    if (server) await stop();
    rmSync(folder, { recursive: true, force: true });
  }
});
