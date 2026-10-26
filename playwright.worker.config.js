import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  testMatch: [
    "workout.spec.js",
    "sync.spec.js",
    "worker-api.spec.js",
    "programs.spec.js",
    "mcp.spec.js",
    "import.spec.js",
    "exercise-history.spec.js",
    "log-defaults.spec.js",
    "landing.spec.js",
    "pwa.spec.js",
    "active-program.spec.js",
  ],
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:8788",
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox"],
    },
  },
  webServer: {
    command: "node scripts/worker-test-server.js",
    url: "http://127.0.0.1:8788/api/health",
    timeout: 60000,
    reuseExistingServer: false,
  },
});
