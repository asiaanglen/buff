import { spawn } from "node:child_process";
import { resolve } from "node:path";
const child = spawn(
  process.execPath,
  [resolve("node_modules/wrangler/bin/wrangler.js"), ...process.argv.slice(2)],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      WRANGLER_SEND_METRICS: process.env.WRANGLER_SEND_METRICS || "false",
      XDG_CONFIG_HOME:
        process.env.XDG_CONFIG_HOME || resolve(".wrangler/config"),
      XDG_CACHE_HOME: process.env.XDG_CACHE_HOME || resolve(".wrangler/cache"),
    },
  },
);
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
process.on("SIGTERM", () => child.kill("SIGTERM"));
process.on("SIGINT", () => child.kill("SIGINT"));
