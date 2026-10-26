import { createApp } from "./app.js";
const { app, close } = createApp();
const server = app.listen(Number(process.env.PORT) || 3001, "0.0.0.0", () =>
  console.log("Buff server is listening."),
);
function shutdown() {
  server.close(() => {
    close();
    process.exit(0);
  });
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
