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

The core workout app requires no external service API keys: Wrangler supplies `DB` and `ASSETS` bindings. Usage monitoring additionally uses the private `USAGE_METRICS_KEY` described below. Origin checks use the current site origin automatically. `PUBLIC_ORIGIN` is optional if you need to restrict sign-ins and writes to a single domain.

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

**Copy week** copies the exercise plans, targets, set counts and supersets into another week. The source logs stay intact, and copied workouts start with empty logs. Existing destination workouts are retained. Changing a program’s dates or length cannot orphan assigned workouts: expand the range or move those workouts first. Only one program can be enrolled at a time. Switching requires confirmation, removes the previous program’s schedule from the planner, and preserves its exercise history and completed workouts. Cancelling leaves the current enrollment unchanged. Unenrolling removes a program’s workouts from both planner views while keeping the program and results; starting it again restores the schedule. Deleting a program removes unlogged workouts and keeps recorded results and exercise notes outside the planner. Use the trash icon on calendar workouts to delete individual entries, including entries left by previously deleted programs. Deletion requires confirmation and permanently removes that workout’s logged sets and notes.

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

In the workout log, check individual sets as you complete them. Use **+ Add set** within an expanded exercise to append another set with empty actual results and prefilled targets (up to 30 sets per exercise). **Mark as complete** accepts every displayed weight and rep/time value and completes the whole workout at once; adjust the prefilled targets to your actual results first. Invalid or blank results prevent bulk completion without partially marking other sets. Existing results, including zero weights, are preserved. Completed workouts appear under **Completed workouts**, turn grey in the program, and advance the active program's next workout. Unchecking a set makes the workout unfinished again while retaining its recorded values.

## Exercise library

Buff includes a shared catalog of 155 common exercises in `shared/exercises.js`, with stable IDs, names, search aliases, muscle groups, equipment and rep/time modes. When adding an exercise, search the library (for example, “RDL” or “neutral grip pull up”), filter by group, and select a movement to fill its name and tracking mode. Sets, targets, weight and supersets remain editable; timed selections default to 45 seconds when switching from reps. You can also type any custom name. Matching custom names from your own workouts appear as private suggestions. Existing workout names and logs are preserved. The MCP read tool `search_exercises` uses the same catalog. The library ships with the app and needs no extra database or paid service.

## Exercise guides, history and notes

Every built-in exercise has **How to** instructions with setup, movement steps and a form cue. Open guides from library results, workout plans or the workout log. Guides match exact exercise names and known aliases; custom movements without a matching guide do not receive unrelated instructions. Closing a guide returns to the current screen without resetting form entries.

The workout log includes an expandable **Workout history** section directly beneath its heading. It shows up to 30 prior matching sessions per exercise, newest first, with recorded weight in lbs, reps or seconds, date, workout name and notes. Current and future-dated sessions are excluded, and rep/time histories stay separate. **Notes for [exercise]** saves up to 1,000 characters with that exercise's session and syncs with the account journal. Editing the exercise plan preserves its notes; copied program weeks start with clean logs and no session notes. The shared catalog and MCP search results include the movement instructions.

## Manage supersets

Use **Supersets** within **Edit plan** or at the bottom of a started workout to group two or more existing exercises. Create multiple named groups, choose an existing group to edit its members or name, or remove a group while keeping its exercises. Exercises in another group are disabled until you remove or edit that group. Group changes preserve all recorded sets and exercise notes and sync with the account. The log shows a heading for each superset with an alternating-set reminder. The **Done logging** button has been removed: results save automatically; use **Collapse workout** to fold its fields or **Mark as complete** to finish the workout.


## Phone-friendly inline logging and swaps

On phones, exercise previews use larger cards instead of a compressed table, navigation and actions have larger tap targets, and log inputs use 16px text. Swipe the weekly schedule horizontally to see other days. The install badge hides while using forms or logging so it does not cover controls.

Choose **Start workout** to begin logging within the workout card. Then tap an exercise heading to expand its sets and results. Only one exercise is expanded within a workout; opening another automatically folds the previous one without clearing its values. **Start workout** opens the first exercise's fields and **Collapse workout** folds them. No separate workout logging screen or **Done logging** button is shown. Guides and session notes remain available in the expanded exercise. Workout history and the same inline logger also work from Completed workouts.

Choose **Swap exercise** to open the library and select a replacement or enter a custom movement. The replacement keeps the planned sets, targets, weight and superset membership unless you adjust them; selecting a different tracking mode supplies a suitable initial target. Existing logged results cannot be reassigned to another movement: swapping is disabled for that exercise once results are entered, while other unlogged exercises remain swappable. Normal exercise dropdowns do not show the library. Adding an exercise still supports library search, and ordinary plan editing shows the selected movement's guide without opening the library.


## Connected AI apps

Open **Account → Manage connected AI apps** to review or disconnect the AI apps authorized through Buff OAuth. AI management is available through Account; there is no separate navigation tab.

Startup shows a branded loading screen while the session and journal are checked, including in the initial HTML before JavaScript loads. Authenticated users go straight from loading to their planner/Home; anonymous users see the public landing page only after the session check. Failed startup shows a retry screen. Session, journal-load and provider-discovery requests have a 15-second timeout. **Swap exercise** sits beside the exercise name in both previews and expanded exercise headings.

On phones, use the **Go to** dropdown at the top to switch between Home, Programs, Weekly planner and Completed workouts. Desktop navigation keeps its sidebar buttons. Before starting, exercise previews show only names, set counts, target reps/time and weight. After starting, exercise headings expand or fold their fields and show logged-set counts.


MCP-created exercises now store an optional `libraryId` when a catalog name or alias matches. MCP exercise inputs also accept `library_id` from `search_exercises` for explicit selection; invalid IDs and conflicting known names are rejected before approval. Recognized timed exercises use timed tracking when no mode is supplied. The Edit exercise dialog shows the selected library entry with its guide and a Swap exercise control, including for older text-only exercises that match a catalog name. Custom movements remain supported. Cable Kickback (glutes, low cable with ankle strap) and Split Squat (both feet on the floor) are included with instructions and plural search aliases.


Workout actions now say **Start workout** (or **Resume workout** after results have been entered). Exercise accordions use exclusive groups plus a JavaScript fallback to keep only one exercise expanded per workout. Set values and notes remain in place when an exercise folds, and any hidden invalid field is opened if bulk completion needs it corrected.

## Focused mobile workout layout

Expanded phone workouts use a light, uncluttered panel with a large rep/time target, the exercise name and swap action, inline instruction cues, an Add note field, and a five-column set table: Set, Previous, Lbs, Reps/Sec, and completion. Previous values come from the matching completed set in the latest earlier session; missing values show a dash. Notes stay with the exercise session and current targets still prefill actual-entry fields. Common movements have shorter inline cues. Expanded workouts show instructions directly without a How to button; full guides remain available in the exercise library and plan editor. Desktop styling stays light. The layout is verified at 320px and 390px, including the Home and Completed workouts contexts.


Before **Start workout**, the exercise list is a read-only preview with no per-exercise logging, swap, guide or edit buttons. **Edit plan** provides the exercise management controls, including adding exercises and managing supersets. Once started, the light workout editor opens the first exercise and keeps only one exercise expanded at a time. The former **Log sets** controls have been removed.

## Align a program with Weekly planner

Weekly planner remains available. **Start program** opens a Week 1 start-date chooser with This Monday / Next Monday shortcuts and a first-week date preview. Confirming activates the program and shifts all its workout dates by the same number of days, preserving numbered weeks, relative days, exercise IDs, notes, supersets and targets. No duplicate workouts are created; unrelated workouts are unchanged. The Home page links directly to the program's next workout in Weekly planner. **Align with planner** is also available from Home and program detail to adjust an unlogged program later.

Program alignment accepts a new start date even after results have been logged. **Today** uses the device’s local calendar date. Every assigned workout, including completed and partially logged workouts, shifts by the same number of days; IDs, sets, results, notes, and numbered program weeks are preserved. The dialog explains that recorded workout dates move too. Invalid dates or a rejected shift leave the whole journal unchanged.

## Share a program with a friend

Choose **Share program** in Programs, program detail, or the active program on Home. The invitation is prepared automatically, with no name-entry step. **Choose contact in Messages** opens the phone’s messaging composer. On iPhone, tap **+** in the **To:** field to select someone from Contacts, then send. iOS does not expose a direct website Contacts picker. The message is:

> Wanna get buff with me? Try out this new workout program!
> [invitation link]

Choose the recipient from your phone's contacts in Messages and send it. Supported phones also offer the native **Share…** sheet; **Copy invitation** works for any messaging app. Buff does not upload contacts, send texts automatically, or use a paid SMS service.

The link opens a public Buff invitation with sign-up/sign-in actions. After authentication, the recipient automatically gets their own copy in **Programs**. Google sign-in carries the invitation through its return URL when Google auth is configured. The plan snapshot includes program/workout plan notes, exercises, sets, targets, weights in lbs and supersets; it excludes logged results and exercise session notes. The recipient gets fresh IDs and empty logs, with the program's relative schedule starting on their local current date. They can choose a different date when starting/alignment. Existing recipient programs, history and active-program choice remain intact.

Links remain available until disabled by their owner under **Manage invitation links** in the sharing dialog. Disabling stops future joins but does not delete copies already added. Revisiting or accepting a link concurrently adds it only once per account. The browser retains pending invitations for up to seven days to carry sign-in across redirects. Workout data is stored in D1 tables added by migration `0004_program_shares.sql`, using conditional journal revisions and an atomic import receipt to prevent duplicates or overwritten edits. Program sharing currently requires the Cloudflare Workers/D1 deployment.

Completed workouts in a program collapse into a grey summary card. Completing the last set or choosing **Mark as complete** in Programs keeps you in the program; **View log** reopens the saved results for review or correction.

Exercise search now appears directly under the **Exercise name** field. **Add New Exercise** opens a private definition form for instructions, rep/time tracking and optional weight tracking. Personal definitions sync with the account, appear in that account’s MCP exercise search, and are copied with a shared program only when used by that program.

## Signup profile fields

New email signups require **First Name**, **Last Name**, and **Date of Birth**. Names accept up to 80 characters, and birth dates must be real calendar dates that are not in the future. New Google accounts prefill available names and complete the same profile fields after authentication. Existing accounts remain usable without a profile-completion prompt.

Account profiles are stored in the `users` table, separately from workout journals and shared program snapshots. An authenticated user can retrieve their own profile through `/api/auth/session`; birth dates are not included in program invitations or MCP workout data. In Cloudflare D1’s `buff` database Console, account owners can view the collected fields with:

```sql
SELECT first_name, last_name, email, date_of_birth FROM users ORDER BY email;
```

Apply `0005_account_profiles.sql` with `npm run db:migrate:remote` before deploying this version. Existing account profile columns remain null until provided; no names or birth dates are inferred for existing users.

## Edit profile

Open **Account → Edit profile** to update First Name, Last Name, Date of Birth, or email. The editor loads the latest account details, validates changes, and provides Save changes and Cancel. Password accounts also have **Change password** with confirmation. Changing email or password requires the current password, preserves the current session, and signs out the account’s other browser sessions. Changing only name or birth date keeps those sessions active. Google-only accounts can update profile details while their email and sign-in remain managed through Google. Workout journals and account IDs are preserved throughout.

## Calendar and drag-to-reschedule

In **Weekly planner**, choose **Week** or **Month** above the calendar. Month shows a Monday-first calendar with all workouts on their assigned dates, previous/next month controls, and Today. Completed workouts appear grey. Drag a workout’s **⠿** handle onto another date with a mouse or a touch screen; touch dragging scrolls the page near the top/bottom edge. You can also select a date, choose **Move** on a workout card, and pick a date without dragging.

Moving a workout changes only its date: IDs, exercises, planned sets, logged results, supersets, and notes are retained and sync to the account’s other devices. Program workouts must stay within the program’s date range; use program alignment to shift the full program. An invalid drop leaves the journal unchanged and displays a message. Calendar month calculations use date-only arithmetic, and Today uses the device’s local calendar date.

## Owner usage monitoring

The owner-only **Account → Usage dashboard** page shows registered accounts, UTC daily active accounts, signups, workout-completion actions, failed sign-ins/syncs, database size, and journals nearing the 1 MB app limit. It offers 7-day and 30-day views. Completing a workout after undoing completion is another completion action; repeated saves of an already-complete workout are not counted again. Existing journal history is not backfilled as new activity.

Hosting traffic and database-operation counters use a **5% random request sample** to limit monitoring overhead. They are labeled estimates, cover Buff rather than the whole Cloudflare account, and exclude background monitoring writes. Use the linked **Cloudflare traffic & CPU errors** and **Cloudflare database metrics** pages for account-wide quota data and platform-level errors. A Worker killed by the platform cannot reliably report its own failure. In-dashboard warnings appear at 70% and 90% of Free-plan allowances. Email/push alerts are not implemented.

Users see a private warning when their journal reaches 750 KB. Offline sync incidents queue one identifier per outage in that account’s browser session and are reported after recovery, with duplicate reports ignored and at most 20 reports accepted per account per UTC day. Monitoring is best effort and does not block successful workout saves if its own writes fail.

Monitoring stores hourly aggregate counters and daily HMAC account hashes, not names, emails, birth dates, passwords, workout names, notes, bodies, or raw URLs. Hashes change each UTC day. Old data is cleaned in bounded batches as sampled traffic arrives, targeting 30 days of retention. This is operational monitoring, not an audit log. Cloudflare’s deployment API token is never placed in the app runtime.

Deployment/setup:

1. Apply `0006_usage_monitoring.sql` with `npm run db:migrate:remote`.
2. Configure a random private **USAGE_METRICS_KEY** with `node scripts/wrangler.js secret put USAGE_METRICS_KEY`; keep this key out of source control and client code. Preserve it across normal deployments.
3. Deploy with `npm run deploy`. `USAGE_SAMPLE_RATE` defaults to `0.05`.
4. From the trusted deployment environment, run `node scripts/create-usage-owner-link.js`. It issues a private one-time setup link valid for 24 hours, or reports that an owner already exists. Issuing a new link invalidates earlier unused links.
5. Give the link only to the app owner. Open it, sign into the intended Buff account, and choose **Enable owner dashboard**. The code is carried in a browser URL fragment, kept out of HTTP URLs, verified on the server, and consumed atomically when ownership is granted.

Ownership is stored by account ID in `usage_owners`, survives email changes, and is never assigned automatically to the first user. There is no public owner-link issuance endpoint. A logged-out request or ordinary user cannot access dashboard data, even if they manually visit `/usage` or `/api/admin/usage`.

Browser tests seed an isolated fake owner in their local D1 database. That fixture is never run during production deployment.

### App themes

Open **Account → App theme** to choose **Buff Classic** or **Muscle Mami**, an optional blush, rose and berry theme with heart accents. The choice saves in the account’s journal, works offline, and syncs to other devices. Signing out returns the public site to Classic. Themes change appearance only.

### YouTube exercise demonstrations

Open **YouTube demonstration** beside expanded exercise instructions or in a library guide. **Find a video on YouTube** searches for that exercise and proper form; paste the selected video’s share link and choose **Save video**. Choices are private to the account and sync with the journal. New personal exercises also accept an optional YouTube video link. No videos are preselected for the shared catalog.

Players load only after **Play demonstration**, use `youtube-nocookie.com`, and stop when the dialog closes. An **Open on YouTube** fallback is available for videos that disable embedding. Only HTTPS YouTube watch, Shorts, live, embed, and youtu.be video links are accepted and normalized; unrelated URLs, executable URLs and channel/search links are rejected. Clear the saved link and save to remove a demonstration. Buff does not download or host the videos; YouTube controls availability, ads and playback.
