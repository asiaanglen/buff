# Buff

A responsive weekly workout planner with account-based cross-device sync, supersets, repetition or time targets, per-set logging, history, and weekly progress.

## Local development

Requires Node.js 24+ (uses built-in SQLite).

```sh
npm ci --cache /workspace/.npm
PUBLIC_ORIGIN=http://127.0.0.1:5173 npm run server
```

In another terminal:

```sh
npm run dev -- --port 5173
```

Vite proxies `/api` to the backend on port 3001. Both processes must run for account sync. Guest mode still works without a server. A sample workout appears on first use.

## Sync and storage

Create an account using **Account** in the top bar, then sign into that account on other devices at the same deployed URL. Plans, supersets, and completed set logs sync automatically. While open, the app checks for changes every 10 seconds and on focus or reconnect. Edits made while offline are cached per account and retried when the connection returns. The app must load online before it can be used; offline reload is not supported.

Your first cloud journal imports your guest workouts. Later sign-ins load the existing cloud journal; use **Import guest workouts** to add guest workout IDs not already present. Signing out returns to your separate guest journal. Pending account changes stay cached on that browser for your next sign-in.

Concurrent changes do not silently overwrite one another. The app pauses sync and offers a downloadable backup and an explicit choice of which version to keep. Conflict resolution currently operates on the whole journal, not individual exercises. Local caches remain on the device after sign-out; use a trusted device and clear site data when needed.

Passwords are hashed using salted scrypt. Sessions use HttpOnly, SameSite cookies, with Secure cookies in production. API requests enforce the configured origin and journal access is scoped to the signed-in user. Password reset and email verification are not implemented yet; use a password manager.

## Render deployment

`render.yaml` defines one **Starter web service** with a **1 GB persistent disk**. Both are paid Render resources. Review the current price in Render before creating them. Keep one service instance; SQLite resides on this attached disk, not a shared multi-instance database.

1. Push the source to `asiaanglen/buff` on GitHub.
2. In Render, create a Blueprint from that repository and review `render.yaml`.
3. Authorize Render to read the repository if it is private, then create the service.
4. Open the generated HTTPS address and create your account. Use the same address and account on each device.

`DATABASE_PATH=/var/data/buff.sqlite` keeps accounts, sessions, plans, and workout history on the persistent disk across process restarts and deploys. Deleting the disk or service can remove this data. Retain database backups separately; a persistent disk is not a substitute for backups. For a live database backup, use SQLite's online backup API or CLI `.backup` command rather than copying only the `.sqlite` file while writes are active.

Render supplies `RENDER_EXTERNAL_URL` for the origin check. If using a custom domain, set `PUBLIC_ORIGIN` to its exact HTTPS origin (no trailing slash) and use that domain consistently. The API and frontend are served by the same Node process.

No deployment has been made automatically. For assisted deployment, provide a Render API key securely through the cloud environment's `RENDER_API_KEY` requirement; do not put it in the repository or chat. This credential is for deployment only and must not be added to the app's client bundle or service environment.

## Production outside Render

```sh
npm ci
npm run build
NODE_ENV=production PUBLIC_ORIGIN=https://your-domain.example DATABASE_PATH=/persistent/path/buff.sqlite npm start
```

Put the service behind HTTPS, route only trusted proxy traffic to it, and keep the database directory on persistent storage. `PORT` defaults to 3001. Production refuses to start without an origin.

## Validation

```sh
npm test
npm run test:e2e
npm run build
```

Unit/API tests cover date boundaries, set independence, account isolation, authentication, cookie flags, origin checks, validation, and stale-revision rejection. Browser tests exercise planning, supersets, logging, persistence, editing, deletion, mobile layout, and two isolated devices syncing with offline changes and conflict resolution. Browser tests start both services with a temporary database and use `/usr/bin/chromium`; set `CHROMIUM_PATH` if needed.
