import { defineConfig } from "vite";
const target = process.env.BUFF_API_TARGET || "http://127.0.0.1:8787";
const coachRedirect = (server) => {
  server.middlewares.use((request, response, next) => {
    const url = new URL(request.url, "http://localhost");
    if (["/coach", "/coach/"].includes(url.pathname)) {
      response.writeHead(302, { Location: "/coach.html" + url.search });
      response.end();
    } else next();
  });
};
export default defineConfig({
  plugins: [
    {
      name: "coach-portal-route",
      configureServer: coachRedirect,
      configurePreviewServer: coachRedirect,
    },
  ],
  build: {
    rollupOptions: { input: { app: "index.html", coach: "coach.html" } },
  },
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
