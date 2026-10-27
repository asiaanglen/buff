import { passwordProof } from "../src/credentials.js";
import { makeVerifier, randomHex } from "../worker/crypto.js";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const storage = mkdtempSync(join(tmpdir(), "buff-worker-tests-"));
const env = {
  ...process.env,
  WRANGLER_SEND_METRICS: "false",
  XDG_CONFIG_HOME: join(storage, "config"),
  XDG_CACHE_HOME: join(storage, "cache"),
};
let child;
async function run(script, args) {
  await new Promise((resolve, reject) => {
    child = spawn(process.execPath, [script, ...args], {
      stdio: "inherit",
      env,
    });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0 ? resolve() : reject(Error(`Command exited with ${code}`)),
    );
  });
}
function cleanup() {
  child?.kill("SIGTERM");
}
process.on("SIGTERM", cleanup);
process.on("SIGINT", cleanup);
try {
  await run("node_modules/vite/bin/vite.js", ["build"]);
  await run("node_modules/wrangler/bin/wrangler.js", [
    "d1",
    "migrations",
    "apply",
    "buff",
    "--local",
    "--persist-to",
    storage,
  ]);
  const salt = randomHex();
  const verifier = await makeVerifier(
    await passwordProof(
      "usage-owner@example.test",
      "usage-owner-only-test-password",
    ),
    salt,
  );
  const seed = join(storage, "usage-owner.sql");
  writeFileSync(
    seed,
    `INSERT INTO users(id,email,password,salt,first_name,last_name,date_of_birth) VALUES('usage-owner-fixture','usage-owner@example.test','${verifier}','${salt}','Usage','Owner','1990-01-15'); INSERT INTO usage_owners(user_id) VALUES('usage-owner-fixture');`,
  );
  await run("node_modules/wrangler/bin/wrangler.js", [
    "d1",
    "execute",
    "buff",
    "--local",
    "--persist-to",
    storage,
    "--file",
    seed,
  ]);
  await run("node_modules/wrangler/bin/wrangler.js", [
    "dev",
    "--port",
    "8788",
    "--var",
    "USAGE_SAMPLE_RATE:1",
    "--var",
    "USAGE_METRICS_KEY:local-usage-test-key-not-for-production",
    "--persist-to",
    storage,
  ]);
} finally {
  rmSync(storage, { recursive: true, force: true });
}
