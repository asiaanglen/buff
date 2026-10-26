import { defineConfig } from "vite";
export default defineConfig({
  server: {
    proxy: { "/api": process.env.BUFF_API_TARGET || "http://127.0.0.1:8787" },
  },
});
