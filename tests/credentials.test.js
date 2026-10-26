import { test } from "node:test";
import assert from "node:assert/strict";
import { passwordProof } from "../src/credentials.js";
import { makeVerifier, checkVerifier, randomHex } from "../worker/crypto.js";
test("password stretching normalizes account identity and verifiers use independent salts", async () => {
  const a = await passwordProof(" Person@Example.com ", "a long safe password");
  assert.equal(
    a,
    await passwordProof("person@example.com", "a long safe password"),
  );
  assert.notEqual(
    a,
    await passwordProof("someone@example.com", "a long safe password"),
  );
  const salt = randomHex(),
    stored = await makeVerifier(a, salt);
  assert.notEqual(stored, a);
  assert.notEqual(stored, await makeVerifier(a, randomHex()));
  assert.equal(await checkVerifier(a, salt, stored), true);
  assert.equal(await checkVerifier("0".repeat(64), salt, stored), false);
});
