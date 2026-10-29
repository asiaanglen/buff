import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { testD1 } from "./support/d1.js";
import { avatarApi, validAvatar, withAvatar } from "../worker/avatar.js";
import { randomHex, digest } from "../worker/crypto.js";
const tiny = new Uint8Array([
  255, 216, 255, 192, 0, 11, 8, 1, 0, 1, 0, 1, 1, 17, 0, 255, 217, 0, 255, 217,
]);
test("profile pictures are private, size-bounded raster images, scoped to the session account, and removable", async () => {
  const db = testD1();
  for (const name of [
    "0001_journal.sql",
    "0005_account_profiles.sql",
    "0010_profile_pictures.sql",
  ])
    db.raw.exec(
      readFileSync(new URL("../migrations/" + name, import.meta.url), "utf8"),
    );
  const actors = {};
  for (const name of ["a", "b"]) {
    const id = randomHex(16),
      token = randomHex();
    db.raw
      .prepare("INSERT INTO users(id,email,password,salt) VALUES(?,?,?,?)")
      .run(id, name + "@test.example", "hash", "salt");
    db.raw
      .prepare("INSERT INTO sessions(token,user_id,expires) VALUES(?,?,?)")
      .run(await digest(token), id, Date.now() + 3600000);
    actors[name] = { id, token };
  }
  const call = (actor, method = "GET", body, headers = {}) =>
    avatarApi(
      new Request("https://buff.test/api/auth/avatar", {
        method,
        headers: {
          Origin: "https://buff.test",
          "Content-Type": "image/jpeg",
          ...(actor ? { Cookie: "buff_session=" + actors[actor].token } : {}),
          ...headers,
        },
        ...(body ? { body } : {}),
      }),
      { DB: db },
    );
  assert.equal((await call(null)).status, 401);
  assert.equal((await call("a")).status, 404);
  assert.equal(
    (await call("a", "PUT", tiny, { Origin: "https://evil.test" })).status,
    403,
  );
  assert.equal(
    (
      await call("a", "PUT", new TextEncoder().encode("<svg></svg>"), {
        "Content-Type": "image/svg+xml",
      })
    ).status,
    400,
  );
  assert.equal((await call("a", "PUT", new Uint8Array(70000))).status, 413);
  assert.equal(validAvatar(tiny), true);
  const oversized = tiny.slice();
  oversized[7] = 3;
  assert.equal(validAvatar(oversized), false);
  assert.equal((await call("a", "PUT", tiny)).status, 200);
  const picture = await call("a");
  assert.equal(picture.status, 200);
  assert.equal(picture.headers.get("Content-Type"), "image/jpeg");
  assert.match(picture.headers.get("Cache-Control"), /no-store/);
  assert.deepEqual(new Uint8Array(await picture.arrayBuffer()), tiny);
  assert.ok((await withAvatar(db, { id: actors.a.id })).avatarVersion);
  assert.equal((await withAvatar(db, { id: actors.b.id })).avatarVersion, null);
  assert.equal((await call("b")).status, 404);
  assert.equal((await call("b", "DELETE")).status, 200);
  assert.equal((await call("a")).status, 200);
  assert.equal((await call("a", "DELETE")).status, 200);
  assert.equal((await call("a")).status, 404);
});
