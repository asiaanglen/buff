import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
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
  await run("node_modules/wrangler/bin/wrangler.js", [
    "dev",
    "--port",
    "8788",
    "--persist-to",
    storage,
  ]);
} finally {
  rmSync(storage, { recursive: true, force: true });
}
