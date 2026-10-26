import { validState } from "../shared/journal.js";
import express from "express";
import { DatabaseSync } from "node:sqlite";
import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
const scrypt = promisify(scryptCallback);
const digest = (s) => createHash("sha256").update(s).digest("hex");
export function createApp({
  databasePath = process.env.DATABASE_PATH || "data/buff.sqlite",
  production = process.env.NODE_ENV === "production",
  publicOrigin = process.env.PUBLIC_ORIGIN || process.env.RENDER_EXTERNAL_URL,
} = {}) {
  if (production && !publicOrigin)
    throw Error("PUBLIC_ORIGIN is required in production");
  if (databasePath !== ":memory:")
    mkdirSync(dirname(resolve(databasePath)), { recursive: true });
  const db = new DatabaseSync(databasePath);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,password TEXT NOT NULL,salt TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS journals (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,revision INTEGER NOT NULL,data TEXT NOT NULL);`);
  const app = express();
  if (production) app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(express.json({ limit: "2mb" }));
  app.use((req, res, next) => {
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Referrer-Policy", "same-origin");
    if (req.path.startsWith("/api/")) res.set("Cache-Control", "no-store");
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const expected = publicOrigin || `${req.protocol}://${req.get("host")}`;
      if (req.get("origin") !== expected)
        return res
          .status(403)
          .json({ error: "Request origin is not allowed." });
    }
    next();
  });
  const limits = new Map();
  app.use("/api/auth", (req, res, next) => {
    if (req.method !== "POST") return next();
    const k = req.ip;
    const now = Date.now();
    let v = limits.get(k);
    if (!v || v.until < now) {
      v = { count: 0, until: now + 15 * 60 * 1000 };
      limits.set(k, v);
    }
    if (++v.count > 30)
      return res
        .status(429)
        .json({ error: "Too many attempts. Try again in 15 minutes." });
    if (limits.size > 10000)
      for (const [key, value] of limits)
        if (value.until < now) limits.delete(key);
    next();
  });
  function identify(req) {
    const token = req.headers.cookie
      ?.split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("buff_session="))
      ?.slice(13);
    if (!token) return null;
    return db
      .prepare(
        "SELECT users.id,users.email FROM sessions JOIN users ON users.id=sessions.user_id WHERE token=? AND expires>?",
      )
      .get(digest(token), Date.now());
  }
  function requireUser(req, res, next) {
    req.user = identify(req);
    if (!req.user)
      return res.status(401).json({ error: "Sign in to sync your workouts." });
    next();
  }
  function session(user, res) {
    const token = randomBytes(32).toString("hex");
    db.prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());
    db.prepare("INSERT INTO sessions VALUES (?,?,?)").run(
      digest(token),
      user.id,
      Date.now() + 30 * 86400000,
    );
    res.cookie("buff_session", token, {
      httpOnly: true,
      secure: production,
      sameSite: "lax",
      maxAge: 30 * 86400000,
      path: "/",
    });
    res.json({ user: { id: user.id, email: user.email } });
  }
  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.get("/api/auth/session", (req, res) =>
    res.json({ user: identify(req) || null }),
  );
  app.post("/api/auth/signup", async (req, res, next) => {
    try {
      const { email, password } = req.body || {};
      if (
        typeof email !== "string" ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        email.length > 254 ||
        typeof password !== "string" ||
        password.length < 12 ||
        password.length > 200
      )
        return res.status(400).json({
          error: "Use a valid email and a password of 12–200 characters.",
        });
      const normalized = email.trim().toLowerCase();
      if (db.prepare("SELECT id FROM users WHERE email=?").get(normalized))
        return res.status(409).json({
          error: "Unable to create this account. Try signing in instead.",
        });
      const salt = randomBytes(16).toString("hex");
      const hash = (await scrypt(password, salt, 64)).toString("hex");
      const user = { id: randomBytes(16).toString("hex"), email: normalized };
      db.prepare("INSERT INTO users VALUES (?,?,?,?)").run(
        user.id,
        normalized,
        hash,
        salt,
      );
      session(user, res);
    } catch (e) {
      next(e);
    }
  });
  app.post("/api/auth/signin", async (req, res, next) => {
    try {
      const { email, password } = req.body || {};
      if (
        typeof email !== "string" ||
        typeof password !== "string" ||
        email.length > 254 ||
        password.length > 200
      )
        return res
          .status(400)
          .json({ error: "Enter your email and password." });
      const user = db
        .prepare("SELECT * FROM users WHERE email=?")
        .get(email.trim().toLowerCase());
      const hash = await scrypt(password, user?.salt || "no-such-user", 64);
      if (!user || !timingSafeEqual(hash, Buffer.from(user.password, "hex")))
        return res
          .status(401)
          .json({ error: "Email or password is incorrect." });
      session(user, res);
    } catch (e) {
      next(e);
    }
  });
  app.post("/api/auth/signout", (req, res) => {
    const token = req.headers.cookie
      ?.split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("buff_session="))
      ?.slice(13);
    if (token)
      db.prepare("DELETE FROM sessions WHERE token=?").run(digest(token));
    res.clearCookie("buff_session", {
      httpOnly: true,
      secure: production,
      sameSite: "lax",
      path: "/",
    });
    res.json({ ok: true });
  });
  app.get("/api/state", requireUser, (req, res) => {
    const row = db
      .prepare("SELECT * FROM journals WHERE user_id=?")
      .get(req.user.id);
    res.json(
      row
        ? { revision: row.revision, state: JSON.parse(row.data) }
        : { revision: 0, state: null },
    );
  });
  app.put("/api/state", requireUser, (req, res) => {
    const { state, revision } = req.body || {};
    if (!Number.isSafeInteger(revision) || revision < 0 || !validState(state))
      return res.status(400).json({ error: "Invalid workout journal." });
    let result;
    if (revision === 0) {
      result = db
        .prepare(
          "INSERT INTO journals (user_id,revision,data) VALUES (?,1,?) ON CONFLICT(user_id) DO NOTHING",
        )
        .run(req.user.id, JSON.stringify(state));
    } else {
      result = db
        .prepare(
          "UPDATE journals SET data=?,revision=revision+1 WHERE user_id=? AND revision=?",
        )
        .run(JSON.stringify(state), req.user.id, revision);
    }
    if (!result.changes)
      return res.status(409).json({
        error:
          "Another device updated your journal. Resolve the conflict before saving.",
      });
    res.json({ revision: revision + 1 });
  });
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "Unknown API endpoint." }),
  );
  app.use(express.static(resolve("dist")));
  app.get("/{*path}", (_req, res) => res.sendFile(resolve("dist/index.html")));
  app.use((err, _req, res, _next) => {
    const status =
      err.type === "entity.too.large"
        ? 413
        : err instanceof SyntaxError
          ? 400
          : 500;
    res.status(status).json({
      error:
        status === 413
          ? "Journal exceeds the 2 MB limit."
          : status === 400
            ? "Invalid JSON request."
            : "The server could not complete this request.",
    });
  });
  return { app, close: () => db.close() };
}
