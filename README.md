# Buff

A responsive weekly workout planner with accounts, cross-device sync, supersets, repetition or time targets, per-set logging, history, and weekly progress.

## Deployed app

Buff is deployed at **https://buff.asiaanglen.workers.dev**. Cloudflare confirmed the deployment and public routing. Live checks verified account creation, saving a 10-week program, loading Week 10 and logged sets from a second session, stale-update protection, and sign-out. The temporary verification account was removed. The full browser workflow also passed against the local Workers/D1 runtime. CSV/XLSX uploads and the authenticated MCP server are deployed, with live OAuth/MCP approval and revocation checks passing.

## Free hosting: Cloudflare Workers + D1

The frontend and API run together on a Cloudflare Worker. Accounts and workout history live in Cloudflare D1, so no paid server or persistent disk is needed. Use a Cloudflare **Free** account/Workers plan and stay within its Workers and D1 allowances. Free hosting is subject to request, database, and storage quotas; monitor usage in Cloudflare. Nothing in this project enables a paid plan or automatic upgrades.

The app uses a free `workers.dev` address; you do not need to buy a domain. A custom domain is optional.

### Deploy

Cloudflare credentials are deployment-only. Never put them in client code, the database, a committed `.env` file, or chat.

For assisted deployment, add `CLOUDFLARE_API_TOKEN` securely in the Codex environment's Secrets settings. The token needs account-scoped **Workers Scripts: Edit**, **D1: Edit**, and **Account Settings: Read** for the intended account. If you have multiple accessible accounts, specify `CLOUDFLARE_ACCOUNT_ID` as a non-secret environment variable.

To deploy yourself with Wrangler:

1. Install dependencies with `npm ci` (Node.js 24+).
2. Authenticate with `npx wrangler login`, or provide `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` through your environment.
3. For this existing deployment, the Worker `buff` and its D1 database already exist; reuse the checked-in bindings. Do not recreate or delete the database. For a different account, set its `account_id`, inspect existing resources, then create a dedicated database with `npx wrangler d1 create buff` if needed. Do not overwrite an unrelated Worker or database.
4. When deploying to a different account, set the returned database ID in the `DB` binding in `wrangler.jsonc`. The existing deployment already has its real database ID configured.
5. Run `npm run db:migrate:remote` to create the database tables.
6. Run `npm run deploy`, then open the returned HTTPS `workers.dev` URL. If Cloudflare asks you to register a workers.dev subdomain, choose one in your account.
7. Create an account and sign into that same account and URL on your other devices.

The deployed app requires **no API keys or secrets in its runtime configuration**: Wrangler supplies `DB` and `ASSETS` bindings. Origin checks use the current site origin automatically. `PUBLIC_ORIGIN` is optional if you need to restrict sign-ins and writes to a single domain.

The deployed Worker uses D1 database `buff` (`50c0fabf-368b-4cba-bf6c-138c861ec637`). Deployment credentials are separate from app accounts: create your own Buff account through the site; no owner login or default password has been created.

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

## Public landing page and authentication

Signed-out visitors see the public landing page with **Sign in** and **Get started free** actions. Opening `/app` or another private app URL without a valid session returns to the landing page; there is no guest planner entry. Signed-in users go directly to their planner, and signing out returns to the landing page. Existing device-only journals are preserved and can be imported into an authenticated account.

Google sign-in is implemented but not enabled until a Google OAuth Web client and Worker credentials are configured. No Google client was created automatically. See [Google sign-in setup](docs/google-signin.md) for the exact callback URL and secure configuration steps. Matching emails are never silently linked to password accounts.

## Exercise history and weight units

All weights are displayed and entered in **pounds (lbs)**, including program imports and MCP tools. Legacy journals labeled `kg` are converted on read (1 kg = 2.2046226218 lbs, rounded to two decimals) and saved as pounds on the next normal save. Existing planned weights and actual logs retain the same physical weight; reps, seconds, completion and exercise identities are unchanged. Unit markers prevent converting an already migrated journal again. Plain CSV `weight` or `weight_lbs` means pounds; an explicit `weight_kg` column is converted automatically.

While logging an exercise, **Last time** shows the last completed set from the most recent matching previous workout, with its date and workout name. Each current set also shows its corresponding prior weight and reps/seconds below the inputs. Only completed actual sets are used, across programs; exercise names match ignoring case and extra spaces, with rep and time tracking kept separate. The current workout and workouts dated after it are excluded. Empty weight and reps/time inputs display their planned targets. Existing results (including zero values) stay intact. Adjust the defaults if needed, then tick the set to record the displayed values as completed; opening the logger alone never completes or records a set.

## CSV and Excel program uploads

In **Programs**, choose **Import program** and upload a `.csv` or `.xlsx` file. Buff previews every workout and reports row errors before anything is saved. Choose the program name, start date, and duration; for Excel workbooks, select the sheet containing your program. Existing workouts are kept and imported logs start empty.

Download the [CSV template](public/buff-program-template.csv) from the upload dialog; Excel can open it and save it as `.xlsx`. Use one exercise per row:

| Column              | Meaning                                                                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `week`              | Program week number, starting at 1. Blank cells continue the prior week.                                                                     |
| `day`               | Optional day 1–7 relative to the program week's start; weekday names are also accepted. Blank cells continue the prior day within that week. |
| `workout`           | Optional workout name; rows with the same week/day/name form one workout.                                                                    |
| `exercise`          | Required exercise name.                                                                                                                      |
| `sets`              | Required whole number, 1–30.                                                                                                                 |
| `reps` or `seconds` | Exactly one positive target per exercise. Leave the other empty.                                                                             |
| `weight`            | Optional pounds (lbs); blank means 0/bodyweight.                                                                                             |
| `superset`          | Optional shared label such as A.                                                                                                             |
| `workout_notes`     | Optional notes for the workout.                                                                                                              |

Files are parsed locally in your browser. Only the resulting program and workouts sync to your account; the spreadsheet itself is not uploaded. Imports are limited to 5 MB, 2,000 exercise rows, 20 MB of expanded workbook content, and the existing 1 MB cloud journal limit. `.xls`, encrypted workbooks, macros, and arbitrary spreadsheet layouts are not supported; use the supplied columns. Invalid rows prevent the entire import, so no partial program is saved.

## Manage Buff from an AI assistant

The authenticated MCP endpoint is **https://buff.asiaanglen.workers.dev/mcp**. It supports reading programs/history, planning workouts, editing targets and logging sets. Write tools produce an exact preview with a link for your approval in Buff; they cannot directly apply changes. Read-only access is also available.

See [MCP setup and tool reference](docs/mcp.md) to connect a custom app in ChatGPT using OAuth. Your personal ChatGPT app connection still requires you to add and authorize it. Disconnect clients under **Account → Manage connected AI apps**.

## Workout programs

Open **Programs → Create program** to choose a name, start date, and any whole-week duration from 1 to 5,200 weeks. Each program has numbered weeks starting on its chosen start date, with its own workout list and completion counts. Create multiple programs with different dates or lengths; they can overlap.

Select **Week 1**, **Week 2**, and so on, or use the week dropdown for longer programs. **Add workout** automatically assigns the workout to that program and week. Choose the workout date within that week. Existing workouts can be assigned through **Edit plan → Program**, and program workouts also appear on their scheduled dates in the weekly planner.

**Copy week** copies the exercise plans, targets, set counts and supersets into another week. The source logs stay intact, and copied workouts start with empty logs. Existing destination workouts are retained. Changing a program’s dates or length cannot orphan assigned workouts: expand the range or move those workouts first. Deleting a program keeps its workouts and logged history in the weekly planner.

Programs and their workout assignments sync with your account. Existing journals without programs remain compatible; no database migration or reset is needed. Guest-workout import includes program definitions and safely remaps conflicting program IDs.

## Sync and storage

Use **Account** in the top bar to create an account and sign in. On other devices, use the same deployed URL and account. Plans, supersets, and completed set logs sync automatically. While the page is visible, it checks for changes every 30 seconds and on focus/reconnect. Local edits sync after a short debounce.

Edits made while offline are cached per account and retried when the server is reachable. Load the app online before going offline; offline reload is not supported. Your first cloud journal imports guest workouts from that device. Later sign-ins load the existing cloud journal; **Import guest workouts** adds guest workout IDs that are not already present. Signing out returns to the landing page and retains the separate device-only journal for later authenticated import.

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

## Install Buff on your phone

Buff is an installable PWA at https://buff.asiaanglen.workers.dev. Tap **Install Buff** for instructions or use Chrome's native install prompt when available. On iPhone/iPad, open it in Safari → Share → Add to Home Screen → Open as Web App (if shown) → Add. On Android, use Chrome → menu → Install app / Add to Home screen. No store account or paid hosting is required.

The manifest includes standard, maskable, and Apple home-screen icons. The service worker caches only public installation resources and a generic offline page; it never caches account APIs, journal data, or authenticated HTML. Opening the installed app requires a connection to verify the account. An already loaded journal retains the existing offline editing and reconnect sync behavior.

## Start a program

Choose **Start program** in the program library or program detail to make it your active program. Your signed-in **Home** page features the earliest unfinished workout in scheduled order, regardless of the current calendar week. Completing every set greys out that workout and promotes the next one after closing the log. Completed logs stay available, and undoing a completed set makes the workout unfinished again. Starting another program changes the focus without resetting any logs. The active choice is stored in your account journal and syncs across devices.

## Complete a workout

In the workout log, check individual sets or use **Exercise complete** to check every set for one exercise. **Mark as complete** accepts every displayed weight and rep/time value and completes the whole workout at once; adjust the prefilled targets to your actual results first. Invalid or blank results prevent bulk completion without partially marking other sets. Existing results, including zero weights, are preserved. Completed workouts appear under **Completed workouts**, turn grey in the program, and advance the active program's next workout. Unchecking a set or exercise makes the workout unfinished again while retaining its recorded values.

## Exercise library

Buff includes a shared catalog of 153 common exercises in `shared/exercises.js`, with stable IDs, names, search aliases, muscle groups, equipment and rep/time modes. When adding an exercise, search the library (for example, “RDL” or “neutral grip pull up”), filter by group, and select a movement to fill its name and tracking mode. Sets, targets, weight and supersets remain editable; timed selections default to 45 seconds when switching from reps. You can also type any custom name. Matching custom names from your own workouts appear as private suggestions. Existing workout names and logs are preserved. The MCP read tool `search_exercises` uses the same catalog. The library ships with the app and needs no extra database or paid service.
