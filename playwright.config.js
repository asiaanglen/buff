import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  testIgnore: [
    "worker-api.spec.js",
    "mcp.spec.js",
    "usage.spec.js",
    "coaching.spec.js",
    "feedback.spec.js",
    "admin.spec.js",
  ],
  use: {
    baseURL: "http://127.0.0.1:5173",
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox"],
    },
  },
  webServer: [
    {
      command: "node server/index.js",
      env: {
        DATABASE_PATH: `/tmp/buff-browser-${process.pid}.sqlite`,
        PORT: "3001",
        PUBLIC_ORIGIN: "http://127.0.0.1:5173",
      },
      url: "http://127.0.0.1:3001/api/health",
      reuseExistingServer: false,
    },
    {
      command: "npm run dev -- --port 5173",
      env: { BUFF_API_TARGET: "http://127.0.0.1:3001" },
      url: "http://127.0.0.1:5173",
      reuseExistingServer: true,
    },
  ],
});
