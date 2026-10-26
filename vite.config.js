import { defineConfig } from "vite";
const target = process.env.BUFF_API_TARGET || "http://127.0.0.1:8787";
export default defineConfig({
  server: {
    proxy: Object.fromEntries(
      [
        "/api",
        "/oauth",
        "/mcp",
        "/.well-known",
        "/approvals",
        "/connections",
      ].map((path) => [path, target]),
    ),
  },
});
