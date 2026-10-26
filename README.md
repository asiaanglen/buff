# Buff

A responsive weekly workout planner with accounts, cross-device sync, supersets, repetition or time targets, per-set logging, history, and weekly progress.

## Free hosting: Cloudflare Workers + D1

The frontend and API run together on a Cloudflare Worker. Accounts and workout history live in Cloudflare D1, so no paid server or persistent disk is needed. Use a Cloudflare **Free** account/Workers plan and stay within its Workers and D1 allowances. Free hosting is subject to request, database, and storage quotas; monitor usage in Cloudflare. Nothing in this project enables a paid plan or automatic upgrades.

The app uses a free `workers.dev` address; you do not need to buy a domain. A custom domain is optional.

### Deploy

Cloudflare credentials are deployment-only. Never put them in client code, the database, a committed `.env` file, or chat.

For assisted deployment, add `CLOUDFLARE_API_TOKEN` securely in the Codex environment's Secrets settings. The token needs account-scoped **Workers Scripts: Edit**, **D1: Edit**, and **Account Settings: Read** for the intended account. If you have multiple accessible accounts, specify `CLOUDFLARE_ACCOUNT_ID` as a non-secret environment variable.

To deploy yourself with Wrangler:

1. Install dependencies with `npm ci` (Node.js 24+).
2. Authenticate with `npx wrangler login`, or provide `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` through your environment.
3. Run `npx wrangler d1 create buff`. Check for an existing database first; do not reuse an unrelated database or overwrite an existing Worker. The checked-in database ID is a local-development placeholder, not a live database.
4. Set the returned database ID in the `DB` binding in `wrangler.jsonc`.
5. Run `npm run db:migrate:remote` to create the database tables.
6. Run `npm run deploy`, then open the returned HTTPS `workers.dev` URL. If Cloudflare asks you to register a workers.dev subdomain, choose one in your account.
7. Create an account and sign into that same account and URL on your other devices.

The deployed app requires **no API keys or secrets in its runtime configuration**: Wrangler supplies `DB` and `ASSETS` bindings. Origin checks use the current site origin automatically. `PUBLIC_ORIGIN` is optional if you need to restrict sign-ins and writes to a single domain.

No Cloudflare deployment has been performed yet; account access is required before creating the remote resources.

## Local development

Requires Node.js 24+. No cloud account is needed for local development.

```sh
npm ci --cache /workspace/.npm
npm run build
npm run db:migrate:local
npm run worker:dev
```

In another terminal:

```sh
npm run dev -- --port 5173
```

Vite serves the frontend and proxies `/api` to the local Worker on port 8787. Wrangler persists the local D1 database in ignored `.wrangler/state` storage. Preserve that directory if you want to retain local accounts and history. Both processes must restart in a new task. The local database and the remote D1 database are separate.

The Worker can also serve the last built frontend directly, without Vite. When doing so, start `npx wrangler dev --port 8787` without the development-only `PUBLIC_ORIGIN` override.

## Sync and storage

Use **Account** in the top bar to create an account and sign in. On other devices, use the same deployed URL and account. Plans, supersets, and completed set logs sync automatically. While the page is visible, it checks for changes every 30 seconds and on focus/reconnect. Local edits sync after a short debounce.

Edits made while offline are cached per account and retried when the server is reachable. Load the app online before going offline; offline reload is not supported. Your first cloud journal imports guest workouts from that device. Later sign-ins load the existing cloud journal; **Import guest workouts** adds guest workout IDs that are not already present. Signing out returns to your separate guest journal.

Concurrent changes do not silently overwrite one another. Sync pauses and offers a downloadable backup and an explicit choice of which journal version to keep. The conflict remains pending across reloads. Local account caches remain on the device after sign-out; use a trusted device and clear site data when needed.

Cloud sync journals are limited to 1 MB per account to fit D1 row limits. Guest data remains stored in browser localStorage under `buff-v1`. A sample upper-body workout is included on first use and can be edited or deleted.

D1 persists data across Worker deployments; deleting a database removes that data. Use Cloudflare's D1 backup/recovery options and download journal backups when needed. Persistent storage is not a substitute for backups.

### Authentication

The Workers backend uses Web Crypto. Browsers stretch passwords with PBKDF2-SHA256 (600,000 iterations and a normalized, account-specific salt). The password-equivalent proof is transmitted over HTTPS; the Worker stores a separate verifier using a random per-user salt and HMAC-SHA256. This keeps password stretching off the Free Worker's CPU budget and avoids storing the reusable proof. Sessions use random tokens in HttpOnly, SameSite cookies, with Secure cookies on HTTPS; only token digests are stored in D1. Account data access and origin checks are enforced server-side. Authentication requests are rate-limited in D1.

Password reset and email verification are not implemented; keep your password in a password manager.

## Validation

```sh
npm test
npm run test:worker
npm run build
npx wrangler deploy --dry-run
```

`test:worker` starts Cloudflare's real local runtime with a temporary migrated D1 database. It tests the browser workflow, mobile layout, account isolation, origin checks, stale-revision rejection, password proof transmission, offline edits, and two-device conflict resolution. It uses `/usr/bin/chromium`; set `CHROMIUM_PATH` if needed. No real cloud credentials are needed.

Unit/API tests cover dates, independent set logs, credentials, and the preserved Node backend. `npm run test:e2e` tests the Node backend separately.

## Existing Node backend

The previous Node/SQLite backend is retained for compatibility and development. Its existing databases and password hashes are unchanged; it is no longer the recommended hosted setup. Stop a running Worker/Vite development server before running the Node browser suite, which uses ports 3001 and 5173.

Run the Node backend with `PUBLIC_ORIGIN=http://127.0.0.1:5173 npm run server`, then `BUFF_API_TARGET=http://127.0.0.1:3001 npm run dev`. Existing Node accounts are not automatically migrated into D1. Keep the original database and download any account journals before switching hosting providers. Guest data already in your browser can be imported when creating the D1 account.
