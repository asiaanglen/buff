import test from "node:test";
import Anthropic from "@anthropic-ai/sdk";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { testD1 } from "./support/d1.js";
import { aiProgramsApi } from "../worker/ai-programs.js";
import { aiBrief, aiPlan } from "./fixtures/ai-program.js";
import {
  aiCatalog,
  aiHistory,
  normalizeAiDraft,
  validateBrief,
} from "../shared/ai-programs.js";
import { digest, randomHex } from "../worker/crypto.js";
import { exercise } from "../src/model.js";
async function setup({ budget = "5", limit = "5", providerFetch } = {}) {
  const db = testD1();
  for (const f of readdirSync(new URL("../migrations/", import.meta.url))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    db.raw.exec(
      readFileSync(new URL("../migrations/" + f, import.meta.url), "utf8"),
    );
  const actors = {};
  for (const name of ["user", "other"]) {
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
    actors[name] = { id, token };
  }
  const old = exercise("Back Squat", 1, 5, "reps", 135);
  old.logs[0] = { weight: 135, actual: 5, done: true };
  old.note = "PRIVATE_SESSION_NOTE";
  const state = {
    version: 1,
    unit: "lbs",
    activeProgramId: "private-plan",
    programs: [
      {
        id: "private-plan",
        name: "PRIVATE_PROGRAM",
        weeks: 2,
        startDate: aiBrief.startDate,
        note: "PRIVATE_PROGRAM_NOTE",
      },
    ],
    workouts: [
      {
        id: "private-workout",
        name: "PRIVATE_WORKOUT",
        programId: "private-plan",
        date: aiBrief.startDate,
        note: "PRIVATE_WORKOUT_NOTE",
        exercises: [old],
      },
    ],
  };
  db.raw
    .prepare("INSERT INTO journals(user_id,revision,data) VALUES(?,1,?)")
    .run(actors.user.id, JSON.stringify(state));
  let next = aiPlan(),
    question = null,
    failure = null,
    hold = null,
    calls = [];
  const client = {
    messages: {
      create: async (parameters) => {
        calls.push(parameters);
        if (hold) await hold;
        if (failure) throw failure;
        return {
          stop_reason: "tool_use",
          content: [
            {
              type: "tool_use",
              name: question ? "ask_program_questions" : "submit_program_draft",
              id: "call-1",
              input: question ? { message: question } : structuredClone(next),
            },
          ],
          usage: { input_tokens: 2500, output_tokens: 1200 },
        };
      },
    },
  };
  const env = {
    DB: db,
    ANTHROPIC_API_KEY: "not-a-real-provider-key",
    AI_PROGRAM_DAILY_BUDGET_USD: budget,
    AI_PROGRAM_USER_DAILY_LIMIT: limit,
  };
  async function call(actor, path = "", method = "GET", data, headers = {}) {
    const r = await aiProgramsApi(
      new Request("https://buff.test/api/ai-programs" + path, {
        method,
        headers: {
          Origin: "https://buff.test",
          "Content-Type": "application/json",
          ...(actor ? { Cookie: "buff_session=" + actors[actor].token } : {}),
          ...headers,
        },
        ...(data ? { body: JSON.stringify(data) } : {}),
      }),
      env,
      {
        createClient: (options) => {
          assert.equal(options.maxRetries, 0);
          return providerFetch
            ? new Anthropic({ ...options, fetch: providerFetch })
            : client;
        },
      },
    );
    return { status: r.status, headers: r.headers, body: await r.json() };
  }
  return {
    db,
    actors,
    state,
    env,
    call,
    calls,
    setQuestion: (message) => {
      question = message;
    },
    setPlan: (p) => {
      next = p;
    },
    setFailure: (e) => {
      failure = e;
    },
    setHold: (p) => {
      hold = p;
    },
  };
}
test("AI drafts use the official client's tool flow, stay private, revise without journal writes, then save a new unenrolled program exactly once", async () => {
  const { db, actors, state, call, calls, setPlan } = await setup();
  assert.equal((await call(null)).status, 401);
  assert.equal(
    (
      await call(
        "user",
        "/generate",
        "POST",
        { brief: aiBrief },
        { Origin: "https://evil.test" },
      )
    ).status,
    403,
  );
  const generated = await call("user", "/generate", "POST", { brief: aiBrief });
  assert.equal(generated.status, 201, JSON.stringify(generated.body));
  const draft = generated.body;
  assert.equal(draft.version, 1);
  assert.equal(draft.plan.workouts.length, 6);
  assert.equal(draft.plan.workouts[0].exercises[0].weight, 0);
  assert.equal(calls[0].tool_choice.name, "submit_program_draft");
  assert.equal(calls[0].model, "claude-sonnet-4-6");
  const sent = JSON.stringify(calls[0]);
  for (const value of [
    "PRIVATE_SESSION_NOTE",
    "PRIVATE_PROGRAM",
    "user@example.test",
    "1990-01-01",
  ])
    assert.ok(!sent.includes(value));
  assert.deepEqual(
    JSON.parse(calls[0].messages[0].content).recent_completed_sets,
    [],
  );
  assert.equal((await call("other", "/" + draft.id)).status, 404);
  assert.equal(
    (await call("other", "/" + draft.id + "/save", "POST", { version: 1 }))
      .status,
    404,
  );
  const old = db.raw
    .prepare("SELECT data FROM journals WHERE user_id=?")
    .get(actors.user.id).data;
  assert.deepEqual(JSON.parse(old), state);
  setPlan(aiPlan("Shorter revised program"));
  const revision = await call("user", "/generate", "POST", {
    id: draft.id,
    version: 1,
    message: "Make the sessions shorter.",
  });
  assert.equal(revision.status, 200);
  assert.equal(revision.body.version, 2);
  assert.equal(revision.body.conversation.length, 4);
  assert.equal(
    (
      await call("user", "/generate", "POST", {
        id: draft.id,
        version: 1,
        message: "Stale edit",
      })
    ).status,
    409,
  );
  assert.equal(
    (await call("user", "/" + draft.id + "/save", "POST", { version: 1 }))
      .status,
    409,
  );
  // A simultaneous client journal edit is retained; saving retries against the latest revision.
  const originalBatch = db.batch.bind(db);
  let race = true;
  db.batch = async (statements) => {
    if (race && statements.length === 2) {
      race = false;
      db.raw
        .prepare(
          "UPDATE journals SET revision=revision+1,data=json_set(data,'$.displayName','Kept client edit') WHERE user_id=?",
        )
        .run(actors.user.id);
    }
    return originalBatch(statements);
  };
  const saved = await call("user", "/" + draft.id + "/save", "POST", {
    version: 2,
  });
  assert.equal(saved.status, 201, JSON.stringify(saved.body));
  const journal = JSON.parse(
    db.raw
      .prepare("SELECT data FROM journals WHERE user_id=?")
      .get(actors.user.id).data,
  );
  assert.equal(journal.activeProgramId, "private-plan");
  assert.equal(journal.displayName, "Kept client edit");
  assert.deepEqual(journal.workouts[0], state.workouts[0]);
  const p = journal.programs.find((p) => p.id === saved.body.programId);
  assert.equal(p.unenrolled, true);
  assert.equal(p.name, "Shorter revised program");
  const workouts = journal.workouts.filter((w) => w.programId === p.id);
  assert.equal(workouts.length, 6);
  assert.equal(workouts[0].exercises[0].libraryId, "back-squat");
  assert.ok(
    workouts.every((w) =>
      w.exercises.every((e) =>
        e.logs.every((l) => l.weight === "" && l.actual === "" && !l.done),
      ),
    ),
  );
  const duplicate = await call("user", "/" + draft.id + "/save", "POST", {
    version: 2,
  });
  assert.equal(duplicate.status, 200);
  assert.equal(duplicate.body.programId, p.id);
  assert.equal(
    JSON.parse(
      db.raw
        .prepare("SELECT data FROM journals WHERE user_id=?")
        .get(actors.user.id).data,
    ).programs.length,
    2,
  );
  assert.equal(
    (
      await call("user", "/generate", "POST", {
        id: draft.id,
        version: 2,
        message: "Change saved program",
      })
    ).status,
    409,
  );
});
test("invalid output or provider failure preserves previous drafts without daily usage limits", async () => {
  const { db, call, calls, setPlan, setFailure } = await setup({
    budget: "1",
    limit: "5",
  });
  const first = await call("user", "/generate", "POST", { brief: aiBrief });
  assert.equal(first.status, 201);
  const bad = aiPlan();
  bad.templates[0].exercises[0].exercise_id = "public:made-up";
  setPlan(bad);
  const failed = await call("user", "/generate", "POST", {
    id: first.body.id,
    version: 1,
    message: "Revise",
  });
  assert.equal(failed.status, 422);
  assert.equal((await call("user", "/" + first.body.id)).body.version, 1);
  setPlan(aiPlan());
  assert.equal(
    (await call("other", "/generate", "POST", { brief: aiBrief })).status,
    201,
  );
  // Legacy environment limits and already-exhausted quota rows cannot block requests.
  const second = await setup({ limit: "1", budget: "0" });
  const day = new Date().toISOString().slice(0, 10);
  second.db.raw
    .prepare(
      "INSERT INTO ai_program_usage(user_id,day,requests) VALUES(?,?,999)",
    )
    .run(second.actors.user.id, day);
  second.db.raw
    .prepare(
      "INSERT INTO ai_program_budgets(day,reserved_micros,requests) VALUES(?,999999999,999)",
    )
    .run(day);
  for (let i = 0; i < 12; i++) {
    assert.equal(
      (await second.call("user", "/generate", "POST", { brief: aiBrief }))
        .status,
      201,
    );
  }
  assert.equal(second.calls.length, 12);
  const status = (await second.call("user")).body;
  assert.equal(status.enabled, true);
  assert.equal("remaining" in status, false);
  assert.equal(
    second.db.raw.prepare("SELECT count(*) AS n FROM ai_program_requests").get()
      .n,
    12,
  );
  const offline = await setup();
  offline.env.ANTHROPIC_API_KEY = "";
  assert.equal((await offline.call("user")).body.enabled, false);
  assert.equal(
    (await offline.call("user", "/generate", "POST", { brief: aiBrief }))
      .status,
    503,
  );
  assert.equal(offline.calls.length, 0);
  const provider = await setup();
  provider.setFailure(
    Object.assign(Error("PRIVATE_PROVIDER_KEY"), { status: 401 }),
  );
  const rejected = await provider.call("user", "/generate", "POST", {
    brief: aiBrief,
  });
  assert.equal(rejected.status, 422);
  assert.ok(!JSON.stringify(rejected.body).includes("PRIVATE_PROVIDER_KEY"));
  assert.equal(
    provider.db.raw.prepare("SELECT count(*) AS n FROM ai_program_drafts").get()
      .n,
    0,
  );
});
test("history is opt-in and revisions use a lease so concurrent tabs cannot overwrite a draft", async () => {
  const { call, calls, setHold } = await setup();
  const first = await call("user", "/generate", "POST", {
    brief: { ...aiBrief, useHistory: true },
  });
  assert.equal(first.status, 201);
  assert.equal(first.body.plan.workouts[0].exercises[0].weight, 95);
  assert.match(JSON.stringify(calls[0]), /weight_lbs\\?":135/);
  let release;
  setHold(
    new Promise((resolve) => {
      release = resolve;
    }),
  );
  const pending = call("user", "/generate", "POST", {
    id: first.body.id,
    version: 1,
    message: "Add variety",
  });
  for (let i = 0; i < 30 && calls.length < 2; i++)
    await new Promise((resolve) => setTimeout(resolve, 1));
  assert.equal(
    (
      await call("user", "/generate", "POST", {
        id: first.body.id,
        version: 1,
        message: "Competing edit",
      })
    ).status,
    409,
  );
  release();
  assert.equal((await pending).status, 200);
});
test("program validation rejects bad schedules and foreign exercise IDs and always derives canonical exercise identity", () => {
  const state = { workouts: [], customExercises: [] };
  const definitions = aiCatalog(state);
  const plan = aiPlan();
  const normalized = normalizeAiDraft(
    plan,
    validateBrief(aiBrief),
    definitions,
  );
  assert.equal(normalized.snapshot.workouts[0].exercises[0].name, "Back Squat");
  const repeat = aiPlan();
  repeat.weeks[1].week = 1;
  assert.throws(() => normalizeAiDraft(repeat, aiBrief, definitions));
  const bad = aiPlan();
  bad.weeks[0].days[1].day = 1;
  assert.throws(() => normalizeAiDraft(bad, aiBrief, definitions));
  const foreign = aiPlan();
  foreign.templates[0].exercises[0].exercise_id = "personal:another-user";
  assert.throws(() => normalizeAiDraft(foreign, aiBrief, definitions));
  assert.equal(aiHistory({ workouts: [] }, definitions).length, 0);
  assert.throws(() => validateBrief({ ...aiBrief, weeks: 53 }));
});

test("the real Anthropic SDK serializes a forced tool request and decodes its draft response", async () => {
  let requests = 0;
  const { db, call } = await setup({
    providerFetch: async (url, options) => {
      requests++;
      assert.equal(String(url), "https://api.anthropic.com/v1/messages");
      assert.equal(
        new Headers(options.headers).get("authorization"),
        "Bearer not-a-real-provider-key",
      );
      const payload = JSON.parse(options.body);
      assert.equal(payload.tool_choice.name, "submit_program_draft");
      assert.equal(payload.tools[0].name, "submit_program_draft");
      assert.equal(payload.max_tokens, 8192);
      return Response.json({
        id: "msg_test",
        type: "message",
        role: "assistant",
        model: payload.model,
        stop_reason: "tool_use",
        stop_sequence: null,
        content: [
          {
            type: "tool_use",
            id: "tool_test",
            name: "submit_program_draft",
            input: aiPlan(),
          },
        ],
        usage: { input_tokens: 2000, output_tokens: 1000 },
      });
    },
  });
  try {
    const result = await call("user", "/generate", "POST", { brief: aiBrief });
    assert.equal(result.status, 201);
    assert.equal(result.body.plan.workouts.length, 6);
    assert.equal(requests, 1);
  } finally {
    db.raw.close();
  }
});

test("natural language intake asks follow-ups, resumes privately, generates and revises a validated program without a form", async () => {
  const { call, calls, setQuestion, setPlan, setFailure, db, actors } =
    await setup();
  const before = db.raw
    .prepare("SELECT data FROM journals WHERE user_id=?")
    .get(actors.user.id).data;
  setQuestion("How many days can you train, and what equipment do you have?");
  const initial = await call("user", "/generate", "POST", {
    message: "I want to get stronger",
    today: aiBrief.startDate,
    useHistory: false,
  });
  assert.equal(initial.status, 201);
  assert.equal(initial.body.plan, null);
  assert.equal(initial.body.version, 1);
  assert.equal(calls[0].tool_choice.type, "any");
  assert.deepEqual(
    calls[0].tools.map((t) => t.name),
    ["ask_program_questions", "submit_program_draft"],
  );
  const id = initial.body.id;
  assert.equal((await call("user")).body.drafts[0].id, id);
  assert.equal(
    (await call("user", "/" + id)).body.conversation[1].text,
    "How many days can you train, and what equipment do you have?",
  );
  assert.equal((await call("other", "/" + id)).status, 404);
  assert.equal(
    (await call("user", "/" + id + "/save", "POST", { version: 1 })).status,
    409,
  );
  assert.equal(
    (
      await call("user", "/generate", "POST", {
        id,
        version: 0,
        message: "Three days",
      })
    ).status,
    409,
  );
  setFailure(Error("provider unavailable"));
  assert.equal(
    (
      await call("user", "/generate", "POST", {
        id,
        version: 1,
        message: "Full gym",
      })
    ).status,
    422,
  );
  assert.equal((await call("user", "/" + id)).body.version, 1);
  setFailure(null);
  setQuestion(null);
  setPlan({ ...aiPlan(), brief: { ...aiBrief, useHistory: true } });
  const ready = await call("user", "/generate", "POST", {
    id,
    version: 1,
    message:
      "3 days, full gym, beginner, 45 minutes, 2 weeks starting November 9.",
  });
  assert.equal(ready.status, 200);
  assert.equal(ready.body.plan.workouts.length, 6);
  assert.equal(ready.body.plan.workouts[0].exercises[0].weight, 0);
  assert.equal(ready.body.brief.useHistory, false);
  assert.equal(
    JSON.parse(calls.at(-1).messages[0].content).recent_discussion[0].text,
    "I want to get stronger",
  );
  setQuestion(
    "Yes, we can keep those sessions balanced. Want to change an exercise?",
  );
  const answered = await call("user", "/generate", "POST", {
    id,
    version: 2,
    message: "Is the program balanced?",
  });
  assert.equal(answered.status, 200);
  assert.deepEqual(answered.body.plan, ready.body.plan);
  assert.equal(
    db.raw
      .prepare("SELECT data FROM journals WHERE user_id=?")
      .get(actors.user.id).data,
    before,
  );
  assert.equal(
    (await call("user", "/" + id + "/save", "POST", { version: 3 })).status,
    201,
  );
});
