# Buff MCP server

Endpoint: **https://buff.asiaanglen.workers.dev/mcp**

Buff implements remote MCP over **Streamable HTTP**, using the official Model Context Protocol TypeScript SDK and Cloudflare OAuth provider. It uses the existing Worker and D1 database; no paid KV namespace, third-party identity service, API key, or new hosting plan is needed. Normal Cloudflare free-tier quotas still apply.

## Connect from ChatGPT

1. Open ChatGPT's Apps settings and the controls for custom MCP apps / Developer mode. Availability depends on your plan and workspace settings.
2. Create a custom app named **Buff** with the MCP endpoint above and **OAuth** authentication. Discovery supports both dynamic client registration and Client ID Metadata Documents, so a compatible client does not need a manually created client ID or secret.
3. Connect the app. Sign into your Buff account on the Buff site when prompted.
4. Review the connecting app's name and callback hostname. Grant read access; also select **Propose workout changes** for planning/logging and **Edit individual exercises** to change exercises inside existing program workouts.
5. In a chat using the Buff app, ask for a program or workout. For example: “Show my programs”, “Plan a 10-week strength program with three workouts a week”, or “Log 8 reps at 90 lbs for my first bench press set.”

The deployed server has passed live checks for OAuth consent, PKCE code exchange, MCP initialization and tools, staged changes, browser-session approval, token refresh and revocation. Adding it to your personal ChatGPT settings still requires your own action. Never enter your Cloudflare deployment token or Buff password into a chat or MCP configuration. The Buff sign-in page handles your login.

## Every change needs approval

Read tools return data immediately. Write tools **only create proposals** and return an approval link. The assistant must show you that link. Open it in Buff to see the exact before/after preview, then approve or reject it. No model-supplied `confirmed` flag can bypass this step.

- Approvals last 15 minutes, are scoped to the connected account, and require the same signed-in browser session that opened the approval page.
- Applying a proposal commits its status and journal change in one D1 transaction.
- If anything changed in the journal meanwhile, approval fails rather than overwriting a newer workout or log. Ask the assistant to prepare a new proposal from current data.
- **Account → Manage connected AI apps** lists connected clients and lets you disconnect them. This revokes access and rejects that client's pending proposals.
- New plans and logs sync back to the normal app. Pending offline browser edits may still require the existing journal conflict resolution flow.

## Tools

| Tool                | Action                                                                    |
| ------------------- | ------------------------------------------------------------------------- |
| `list_programs`     | List programs and workout counts, with pagination.                        |
| `get_program`       | Read a program or its workouts in a numbered week.                        |
| `list_workouts`     | Read scheduled workouts or logged history, with date/program filters.     |
| `get_workout`       | Read exercises, IDs, planned targets, supersets and actual logs.          |
| `get_change_status` | Check a proposal's approval, rejection or expiration.                     |
| `create_program`    | Propose a custom-length program, optionally including up to 100 workouts. |
| `update_program`    | Propose changes to name, dates, notes and duration.                       |
| `plan_workout`      | Propose a workout and its exercises for a date or program week/day.       |
| `update_workout`    | Propose edits while keeping recorded exercise logs.                       |
| `add_exercises`     | Propose exercises and supersets in an existing workout.                   |
| `update_exercise`   | Propose target/set/superset changes without removing recorded sets.       |
| `log_sets`          | Propose actual weight, reps or seconds for specific sets.                 |
| `copy_program_week` | Propose copying workouts to another week with fresh logs.                 |

Weights are pounds (lbs); 0 means bodyweight. `mode` is `reps` or `time` (seconds). Set numbers and program weeks are 1-based. A program workout's `day` is 1–7 relative to that program week's start, not necessarily Monday–Sunday. Use the IDs from read tools. The MCP server only accesses the account that granted OAuth permission.

## Protocol and security

- OAuth 2.1 authorization code flow with PKCE S256, exact registered callback validation, resource/audience binding, scoped access, rotating refresh tokens, revocation, and server discovery.
- Read scope: `buff:read`; general proposal scope: `buff:write`; individual exercise additions/edits: `buff:exercises:write`; optional `offline_access`.
- `update_exercise` and `add_exercises` require `buff:read` plus `buff:exercises:write`. General write permission does not imply this scope. An exercise-only grant can edit existing exercises without permission to create programs, reschedule workouts or log sets.
- For an existing connection, reconnect/re-authorize Buff and select **Edit individual exercises**. Existing grants and refresh tokens are not silently expanded. Missing-scope tool responses request the exact scope through MCP authorization metadata.
- `update_exercise` accepts optional `program_id` as a guard that the specified workout belongs to that program; `workout_id` and `exercise_id` identify the exact exercise to change. Changes remain staged until approved, and existing recorded sets cannot be discarded.
- OAuth provider records use a KV-compatible D1 adapter supporting expiry, metadata and pagination. Tokens/codes are stored as the provider's hashes, and token-associated application props are encrypted by the provider. Deployment tokens are never used as MCP credentials.
- Browser consent is bound to both the OAuth browser handle and the signed-in Buff session. Consent/approval pages reject framing, escape untrusted names/notes, and use CSRF checks. Approval endpoints do not accept MCP bearer authentication in place of a Buff browser session.
- D1 serializes code/refresh exchanges with short-lived locks. Reusing an authorization code is rejected and revokes the affected grant, according to the OAuth provider's replay handling.

Discovery endpoints are `/.well-known/oauth-protected-resource/mcp` and `/.well-known/oauth-authorization-server`. Authorization, registration and token/revocation endpoints are `/oauth/authorize`, `/oauth/register` and `/oauth/token`. Keep these paths and `/mcp` on the same deployed origin. Do not expose localhost URLs as a remote ChatGPT app.

## Develop and test

Use `npm run test:worker` for real local Worker/D1 browser and SDK tests. MCP is supported by the Workers backend, not the retained legacy Node server. Local Vite proxies MCP, OAuth, consent, and approval routes to the Worker; `PUBLIC_ORIGIN` is the frontend origin when a proxy is used. For a direct Worker-only preview, omit that override and use the Worker origin consistently.

Migrations are additive. Apply `npm run db:migrate:remote` before redeployment, then `npm run deploy`. Never reset the existing database. The tests use isolated temporary databases and registered test clients.
