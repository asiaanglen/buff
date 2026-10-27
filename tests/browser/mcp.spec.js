import { signupProfile } from "../signup-profile.js";
import { test, expect } from "@playwright/test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { randomBytes, createHash } from "node:crypto";
import { passwordProof, authScheme } from "../../src/credentials.js";
async function connect(page, base, write = true, editExercises = write) {
  const email = `mcp-${Date.now()}-${randomBytes(3).toString("hex")}@example.com`;
  const signup = await page.request.post(base + "/api/auth/signup", {
    headers: { Origin: base },
    data: {
      email,
      password: await passwordProof(email, "a private workout password"),
      ...signupProfile,
      credentialVersion: authScheme,
    },
  });
  expect(signup.status()).toBe(200);
  const registered = await page.request.post(base + "/oauth/register", {
    data: {
      client_name: "Buff MCP test",
      redirect_uris: ["http://127.0.0.1/callback"],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    },
  });
  expect(registered.status()).toBe(201);
  const registration = await registered.json();
  const verifier = randomBytes(32).toString("base64url"),
    challenge = createHash("sha256").update(verifier).digest("base64url");
  const args = new URLSearchParams({
    client_id: registration.client_id,
    response_type: "code",
    redirect_uri: "http://127.0.0.1/callback",
    scope: "buff:read buff:write buff:exercises:write offline_access",
    state: "test-state",
    code_challenge: challenge,
    code_challenge_method: "S256",
    resource: base + "/mcp",
  });
  await page.route("http://127.0.0.1/callback**", (route) =>
    route.fulfill({ body: "Connected" }),
  );
  await page.goto(base + "/oauth/authorize?" + args);
  await expect(
    page.getByRole("heading", { name: "Connect an app to Buff" }),
  ).toBeVisible();
  if (!write) await page.getByLabel("Propose workout changes").uncheck();
  if (!editExercises)
    await page.getByLabel("Edit individual exercises").uncheck();
  await page.getByRole("button", { name: "Connect app", exact: true }).click();
  await page.waitForURL("http://127.0.0.1/callback**", { timeout: 5000 });
  const code = new URL(page.url()).searchParams.get("code");
  expect(code).toBeTruthy();
  expect(new URL(page.url()).searchParams.get("state")).toBe("test-state");
  const tokenResult = await page.request.post(base + "/oauth/token", {
    form: {
      grant_type: "authorization_code",
      client_id: registration.client_id,
      code,
      redirect_uri: "http://127.0.0.1/callback",
      code_verifier: verifier,
      resource: base + "/mcp",
    },
  });
  expect(tokenResult.status()).toBe(200);
  const tokens = await tokenResult.json();
  const client = new Client({ name: "buff-test", version: "1" });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(base + "/mcp"), {
      requestInit: {
        headers: { Authorization: "Bearer " + tokens.access_token },
      },
    }),
  );
  return { client, tokens, registration, email, code, verifier };
}
test("MCP OAuth discovery, SDK tools, browser approval, refresh and revocation work end to end", async ({
  page,
  baseURL,
}) => {
  const denied = await page.request.post("/mcp", {
    data: { jsonrpc: "2.0", method: "initialize", id: 1 },
  });
  expect(denied.status()).toBe(401);
  expect(denied.headers()["www-authenticate"]).toContain("resource_metadata");
  const metadata = await (
    await page.request.get("/.well-known/oauth-authorization-server")
  ).json();
  expect(metadata.code_challenge_methods_supported).toContain("S256");
  expect(metadata.scopes_supported).toContain("buff:exercises:write");
  const { client, tokens, registration } = await connect(page, baseURL);
  try {
    const names = (await client.listTools()).tools.map((t) => t.name);
    expect(names).toContain("search_exercises");
    const catalogResult = await client.callTool({
      name: "search_exercises",
      arguments: { query: "RDL" },
    });
    const catalog = JSON.parse(catalogResult.content[0].text);
    expect(catalog.exercises.some((e) => e.name === "Romanian Deadlift")).toBe(
      true,
    );

    expect(names).toContain("create_program");
    expect(names).toContain("log_sets");
    const proposal = await client.callTool({
      name: "create_program",
      arguments: {
        name: "MCP 10-week build",
        start_date: "2026-11-02",
        weeks: 10,
        workouts: [
          {
            name: "Upper body",
            week: 1,
            day: 1,
            exercises: [
              {
                name: "Bench press",
                library_id: "barbell-bench-press",
                sets: 3,
                target: 8,
                weight: 40,
              },
            ],
          },
        ],
      },
    });
    expect(proposal.isError).not.toBe(true);
    const pending = proposal.structuredContent;
    expect(pending.status).toBe("pending_approval");
    expect(
      (await (await page.request.get("/api/state")).json()).state,
    ).toBeNull();
    await page.goto(pending.approvalUrl);
    await expect(page.locator("pre")).toContainText("Barbell Bench Press");
    await page.getByRole("button", { name: "Approve changes" }).click();
    await expect(
      page.getByRole("heading", { name: "Change applied" }),
    ).toBeVisible();
    const programs = await client.callTool({
      name: "list_programs",
      arguments: {},
    });
    expect(programs.structuredContent.programs[0].weeks).toBe(10);
    const status = await client.callTool({
      name: "get_change_status",
      arguments: { change_id: pending.changeId },
    });
    expect(status.structuredContent.status).toBe("applied");
    const programId = programs.structuredContent.programs[0].id;
    const detail = await client.callTool({
      name: "get_program",
      arguments: { program_id: programId, week: 1 },
    });
    const workout = detail.structuredContent.workouts[0],
      bench = workout.exercises[0];
    expect(bench.libraryId).toBe("barbell-bench-press");
    const log = await client.callTool({
      name: "log_sets",
      arguments: {
        workout_id: workout.id,
        sets: [{ exercise_id: bench.id, set_number: 2, weight: 40, actual: 8 }],
      },
    });
    await page.goto(log.structuredContent.approvalUrl);
    await page.getByRole("button", { name: "Approve changes" }).click();
    await expect(
      page.getByRole("heading", { name: "Change applied" }),
    ).toBeVisible();
    const unsafe = await client.callTool({
      name: "update_exercise",
      arguments: { workout_id: workout.id, exercise_id: bench.id, sets: 1 },
    });
    expect(unsafe.isError).toBe(true);
    expect(unsafe.content[0].text).toContain("recorded sets");
    const update = await client.callTool({
      name: "update_exercise",
      arguments: { workout_id: workout.id, exercise_id: bench.id, target: 10 },
    });
    await page.goto(update.structuredContent.approvalUrl);
    await page.getByRole("button", { name: "Approve changes" }).click();
    await expect(
      page.getByRole("heading", { name: "Change applied" }),
    ).toBeVisible();
    const logged = await client.callTool({
      name: "get_workout",
      arguments: { workout_id: workout.id },
    });
    expect(logged.structuredContent.workout.exercises[0].target).toBe(10);
    expect(logged.structuredContent.workout.exercises[0].logs[1].actual).toBe(
      "8",
    );
    const refreshed = await page.request.post("/oauth/token", {
      form: {
        grant_type: "refresh_token",
        client_id: registration.client_id,
        refresh_token: tokens.refresh_token,
        resource: baseURL + "/mcp",
      },
    });
    expect(refreshed.status()).toBe(200);
    const unapproved = await client.callTool({
      name: "create_program",
      arguments: {
        name: "Do not apply after disconnect",
        start_date: "2026-11-02",
        weeks: 4,
      },
    });
    await page.goto(baseURL + "/connections");
    await page.getByRole("button", { name: "Disconnect app" }).click();
    await expect(page.getByText("No apps are connected.")).toBeVisible();
    await page.goto(unapproved.structuredContent.approvalUrl);
    await expect(
      page.getByRole("heading", { name: "Change rejected" }),
    ).toBeVisible();
    const revoked = await page.request.post("/mcp", {
      headers: {
        Authorization: "Bearer " + tokens.access_token,
        Accept: "application/json, text/event-stream",
      },
      data: { jsonrpc: "2.0", id: 2, method: "tools/list" },
    });
    expect(revoked.status()).toBe(401);
  } finally {
    await client.close();
  }
});
test("read-only OAuth access cannot propose writes", async ({
  page,
  baseURL,
}) => {
  const { client } = await connect(page, baseURL, false);
  try {
    expect(
      (await client.callTool({ name: "list_programs", arguments: {} })).isError,
    ).not.toBe(true);
    const result = await client.callTool({
      name: "create_program",
      arguments: { name: "Not permitted", start_date: "2026-11-02", weeks: 4 },
    });
    expect(result.isError).toBe(true);
    expect(result._meta["mcp/www_authenticate"][0]).toContain("buff:write");
  } finally {
    await client.close();
  }
});
test("MCP proposals cannot overwrite newer journal data and approval CSRF is checked", async ({
  page,
  baseURL,
}) => {
  const { client } = await connect(page, baseURL);
  try {
    const proposed = await client.callTool({
      name: "create_program",
      arguments: { name: "Stale program", start_date: "2026-11-02", weeks: 4 },
    });
    const pending = proposed.structuredContent;
    await page.goto(pending.approvalUrl);
    const csrf = await page.locator('[name="csrf"]').inputValue();
    expect(
      (
        await page.request.post(pending.approvalUrl, {
          headers: { Origin: "https://evil.example" },
          form: { csrf, decision: "approve" },
        })
      ).status(),
    ).toBe(403);
    await page.request.put("/api/state", {
      headers: { Origin: baseURL },
      data: {
        state: { version: 1, unit: "kg", programs: [], workouts: [] },
        revision: 0,
      },
    });
    await page.getByRole("button", { name: "Approve changes" }).click();
    await expect(
      page.getByRole("heading", { name: "Your journal changed" }),
    ).toBeVisible();
    const state = await (await page.request.get("/api/state")).json();
    expect(state.revision).toBe(1);
    expect(state.state.programs).toHaveLength(0);
  } finally {
    await client.close();
  }
});

test("OAuth rejects code reuse and another account cannot approve or read a proposal", async ({
  page,
  browser,
  baseURL,
}) => {
  const { client, tokens, registration, code, verifier } = await connect(
    page,
    baseURL,
  );
  const other = await browser.newContext();
  try {
    const proposal = await client.callTool({
      name: "create_program",
      arguments: {
        name: "Private program",
        start_date: "2026-11-02",
        weeks: 4,
      },
    });
    const b = await other.newPage(),
      email = `other-mcp-${Date.now()}@example.com`;
    await b.request.post(baseURL + "/api/auth/signup", {
      headers: { Origin: baseURL },
      data: {
        email,
        password: await passwordProof(email, "another private password"),
        ...signupProfile,
        credentialVersion: authScheme,
      },
    });
    expect(
      (await b.request.get(proposal.structuredContent.approvalUrl)).status(),
    ).toBe(404);
    const foreignId = crypto.randomUUID();
    await b.request.put(baseURL + "/api/state", {
      headers: { Origin: baseURL },
      data: {
        revision: 0,
        state: {
          version: 1,
          unit: "kg",
          programs: [
            {
              id: foreignId,
              name: "Other account data",
              startDate: "2026-11-02",
              weeks: 4,
              note: "",
            },
          ],
          workouts: [],
        },
      },
    });
    const read = await client.callTool({
      name: "get_program",
      arguments: { program_id: foreignId },
    });
    expect(read.isError).toBe(true);
    expect(read.content[0].text).not.toContain("Other account data");
    const replay = await page.request.post(baseURL + "/oauth/token", {
      form: {
        grant_type: "authorization_code",
        client_id: registration.client_id,
        code,
        redirect_uri: "http://127.0.0.1/callback",
        code_verifier: verifier,
        resource: baseURL + "/mcp",
      },
    });
    expect(replay.status()).toBe(400);
    expect(
      (
        await page.request.post(baseURL + "/mcp", {
          headers: {
            Authorization: "Bearer " + tokens.access_token,
            Accept: "application/json, text/event-stream",
          },
          data: { jsonrpc: "2.0", id: 1, method: "tools/list" },
        })
      ).status(),
    ).toBe(401);
  } finally {
    await client.close();
    await other.close();
  }
});

test("OAuth signs in through Buff and returns to consent in a fresh browser", async ({
  page,
  request,
  baseURL,
}) => {
  const email = `login-mcp-${Date.now()}@example.com`,
    password = "a private return password";
  expect(
    (
      await request.post("/api/auth/signup", {
        headers: { Origin: baseURL },
        data: {
          email,
          password: await passwordProof(email, password),
          ...signupProfile,
          credentialVersion: authScheme,
        },
      })
    ).status(),
  ).toBe(200);
  const registration = await (
    await request.post("/oauth/register", {
      data: {
        client_name: "Fresh browser test",
        redirect_uris: ["http://127.0.0.1/callback"],
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
      },
    })
  ).json();
  const verifier = randomBytes(32).toString("base64url"),
    challenge = createHash("sha256").update(verifier).digest("base64url");
  const args = new URLSearchParams({
    client_id: registration.client_id,
    response_type: "code",
    redirect_uri: "http://127.0.0.1/callback",
    scope: "buff:read",
    state: "fresh-login",
    code_challenge: challenge,
    code_challenge_method: "S256",
    resource: baseURL + "/mcp",
  });
  await page.goto(baseURL + "/oauth/authorize?" + args);
  await expect(
    page.getByRole("heading", { name: "Sign in to Buff" }),
  ).toBeVisible();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByRole("button", { name: "Sign in →", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Connect an app to Buff" }),
  ).toBeVisible();
  await expect(page.getByText(email, { exact: true })).toBeVisible();
});

test("exercise-only permission edits one exercise in an existing program without granting general writes", async ({
  page,
  baseURL,
}) => {
  const { client } = await connect(page, baseURL, false, true);
  try {
    const programId = crypto.randomUUID(),
      workoutId = crypto.randomUUID(),
      exerciseId = crypto.randomUUID();
    const state = {
      version: 1,
      unit: "lbs",
      programs: [
        {
          id: programId,
          name: "Existing build",
          startDate: "2026-11-02",
          weeks: 10,
          note: "",
        },
      ],
      workouts: [
        {
          id: workoutId,
          programId,
          date: "2026-11-02",
          name: "Upper",
          note: "Keep this workout",
          exercises: [
            {
              id: exerciseId,
              name: "Bench",
              sets: 2,
              target: 8,
              mode: "reps",
              weight: 90,
              group: "",
              logs: [
                { weight: "90", actual: "8", done: true },
                { weight: "", actual: "", done: false },
              ],
            },
          ],
        },
      ],
    };
    expect(
      (
        await page.request.put("/api/state", {
          headers: { Origin: baseURL },
          data: { state, revision: 0 },
        })
      ).status(),
    ).toBe(200);
    const tools = (await client.listTools()).tools;
    const edit = tools.find((t) => t.name === "update_exercise");
    expect(edit._meta.securitySchemes[0].scopes).toEqual([
      "buff:read",
      "buff:exercises:write",
    ]);
    const denied = await client.callTool({
      name: "create_program",
      arguments: {
        name: "No general write access",
        start_date: "2026-11-02",
        weeks: 4,
      },
    });
    expect(denied.isError).toBe(true);
    expect(denied._meta["mcp/www_authenticate"][0]).toContain("buff:write");
    const wrong = await client.callTool({
      name: "update_exercise",
      arguments: {
        program_id: "wrong-program",
        workout_id: workoutId,
        exercise_id: exerciseId,
        target: 10,
      },
    });
    expect(wrong.isError).toBe(true);
    expect(wrong.content[0].text).toContain("does not belong");
    const proposed = await client.callTool({
      name: "update_exercise",
      arguments: {
        program_id: programId,
        workout_id: workoutId,
        exercise_id: exerciseId,
        name: "Barbell bench press",
        sets: 3,
        target: 10,
        weight: 95,
        superset: "A",
      },
    });
    expect(proposed.isError).not.toBe(true);
    expect(proposed.structuredContent.status).toBe("pending_approval");
    expect(
      (await (await page.request.get("/api/state")).json()).state.workouts[0]
        .exercises[0].target,
    ).toBe(8);
    await page.goto(proposed.structuredContent.approvalUrl);
    await page.getByRole("button", { name: "Approve changes" }).click();
    await expect(
      page.getByRole("heading", { name: "Change applied" }),
    ).toBeVisible();
    const saved = (await (await page.request.get("/api/state")).json()).state;
    expect(saved.programs).toEqual(state.programs);
    expect(saved.workouts[0].note).toBe("Keep this workout");
    expect(saved.workouts[0].exercises[0]).toMatchObject({
      id: exerciseId,
      name: "Barbell bench press",
      sets: 3,
      target: 10,
      weight: 95,
      group: "A",
    });
    expect(saved.workouts[0].exercises[0].logs[0]).toEqual({
      weight: "90",
      actual: "8",
      done: true,
    });
  } finally {
    await client.close();
  }
});
test("existing broad-write grants need new consent before editing individual exercises", async ({
  page,
  baseURL,
}) => {
  const { client } = await connect(page, baseURL, true, false);
  try {
    const denied = await client.callTool({
      name: "update_exercise",
      arguments: { workout_id: "any", exercise_id: "any", target: 10 },
    });
    expect(denied.isError).toBe(true);
    expect(denied._meta["mcp/www_authenticate"][0]).toContain(
      "buff:exercises:write",
    );
    const add = await client.callTool({
      name: "add_exercises",
      arguments: {
        workout_id: "any",
        exercises: [{ name: "Row", sets: 3, target: 10 }],
      },
    });
    expect(add.isError).toBe(true);
    expect(add._meta["mcp/www_authenticate"][0]).toContain(
      "buff:exercises:write",
    );
  } finally {
    await client.close();
  }
});

test("MCP searches the account's personal library and links its definitions when planning", async ({
  page,
  baseURL,
}) => {
  const definition = {
    id: "personal-hold",
    name: "My private balance hold",
    mode: "time",
    weighted: false,
    instructions: "Balance and breathe slowly.",
  };
  const { client } = await connect(page, baseURL);
  const put = await page.request.put("/api/state", {
    headers: { Origin: baseURL },
    data: {
      revision: 0,
      state: {
        version: 1,
        unit: "lbs",
        programs: [],
        workouts: [],
        customExercises: [definition],
      },
    },
  });
  expect(put.ok()).toBeTruthy();
  try {
    const found = await client.callTool({
      name: "search_exercises",
      arguments: { query: "private balance" },
    });
    expect(found.structuredContent.exercises).toEqual([
      expect.objectContaining({
        id: definition.id,
        personal: true,
        weighted: false,
      }),
    ]);
    const proposal = await client.callTool({
      name: "plan_workout",
      arguments: {
        name: "Balance session",
        date: "2026-10-26",
        exercises: [
          {
            name: definition.name,
            library_id: definition.id,
            sets: 2,
            target: 30,
            weight: 50,
          },
        ],
      },
    });
    expect(proposal.isError).not.toBe(true);
    await page.goto(proposal.structuredContent.approvalUrl);
    await page
      .getByRole("button", { name: "Approve changes", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Change applied" }),
    ).toBeVisible();
    const { state } = await (await page.request.get("/api/state")).json();
    expect(state.workouts[0].exercises[0]).toMatchObject({
      customExerciseId: definition.id,
      mode: "time",
      weight: 0,
      weighted: false,
      instructions: definition.instructions,
    });
  } finally {
    await client.close();
  }
});
