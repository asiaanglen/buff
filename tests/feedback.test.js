import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { testD1 } from "./support/d1.js";
import { feedbackPage } from "../worker/feedback.js";
import { digest, randomHex } from "../worker/crypto.js";

test("feedback is private, bounded, idempotent, rate limited, and only the owner can manage it", async () => {
  const db = testD1();
  for (const file of [
    "0001_journal.sql",
    "0005_account_profiles.sql",
    "0008_feedback.sql",
  ])
    db.raw.exec(
      readFileSync(new URL("../migrations/" + file, import.meta.url), "utf8"),
    );
  db.raw.exec("CREATE TABLE usage_owners(user_id TEXT PRIMARY KEY)");
  const actors = {};
  for (const name of ["owner", "user", "other"]) {
    const token = randomHex();
    const id = randomHex(16);
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
        "Test",
        "1990-01-01",
      );
    db.raw
      .prepare("INSERT INTO sessions(token,user_id,expires) VALUES(?,?,?)")
      .run(await digest(token), id, Date.now() + 3600000);
    actors[name] = { id, token };
  }
  db.raw
    .prepare("INSERT INTO usage_owners(user_id) VALUES(?)")
    .run(actors.owner.id);
  async function call(actor, path = "/feedback", fields, headers = {}) {
    return feedbackPage(
      new Request("https://buff.test" + path, {
        method: fields ? "POST" : "GET",
        headers: {
          Origin: "https://buff.test",
          "User-Agent": "Example phone browser",
          ...(actor ? { Cookie: "buff_session=" + actors[actor].token } : {}),
          ...(fields
            ? { "Content-Type": "application/x-www-form-urlencoded" }
            : {}),
          ...headers,
        },
        ...(fields ? { body: new URLSearchParams(fields) } : {}),
      }),
      { DB: db },
    );
  }
  assert.equal((await call(null)).status, 303);
  assert.equal((await call("user", "/feedback/inbox")).status, 404);
  const form = await call("user", "/feedback", undefined, {
    Referer: "https://buff.test/coach?invite=secret",
  });
  const html = await form.text();
  assert.match(html, /name="page" value="\/coach"/);
  assert.ok(!html.includes("secret"));
  const id = html.match(/name="id" value="([a-f0-9]{32})"/)[1];
  const fields = {
    id,
    kind: "bug",
    message: "<script>alert(1)</script>",
    steps: "Tap timer",
    diagnostics: "yes",
    page: "/coach",
  };
  assert.equal(
    (await call("user", "/feedback", fields, { Origin: "https://evil.test" }))
      .status,
    403,
  );
  assert.equal(
    (await call("user", "/feedback", { ...fields, message: "" })).status,
    400,
  );
  assert.equal(
    (await call("user", "/feedback", { ...fields, message: "x".repeat(3001) }))
      .status,
    400,
  );
  assert.equal((await call("user", "/feedback", fields)).status, 303);
  assert.equal((await call("user", "/feedback", fields)).status, 303);
  assert.equal(
    db.raw.prepare("SELECT count(*) AS n FROM feedback_reports").get().n,
    1,
  );
  const row = db.raw
    .prepare("SELECT * FROM feedback_reports WHERE id=?")
    .get(id);
  assert.equal(row.browser, "Example phone browser");
  assert.equal(row.source_path, "/coach");
  const inbox = await call("owner", "/feedback/inbox");
  const content = await inbox.text();
  assert.ok(content.includes("&lt;script&gt;"));
  assert.ok(!content.includes("<script>"));
  assert.ok(content.includes("user@example.test"));
  assert.equal(
    (await call("other", "/feedback/inbox", { id, status: "resolved" })).status,
    404,
  );
  assert.equal(
    (await call("owner", "/feedback/inbox", { id, status: "resolved" })).status,
    303,
  );
  assert.equal(
    db.raw.prepare("SELECT status FROM feedback_reports WHERE id=?").get(id)
      .status,
    "resolved",
  );
  const privateId = randomHex(16);
  assert.equal(
    (
      await call("user", "/feedback", {
        ...fields,
        id: privateId,
        diagnostics: "no",
        page: "/approvals/secret?token=private",
      })
    ).status,
    303,
  );
  const privateRow = db.raw
    .prepare("SELECT * FROM feedback_reports WHERE id=?")
    .get(privateId);
  assert.equal(privateRow.browser, "");
  assert.equal(privateRow.source_path, "");
  for (let i = 0; i < 8; i++)
    assert.equal(
      (await call("user", "/feedback", { ...fields, id: randomHex(16) }))
        .status,
      303,
    );
  assert.equal(
    (await call("user", "/feedback", { ...fields, id: randomHex(16) })).status,
    429,
  );
});
