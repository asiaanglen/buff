# In-app AI program creator

Signed-in users and coaches can choose **Programs → Create with AI** or visit `/create-with-ai`. Complete a short form, review every numbered week, and request changes in chat. **Save program** creates a new, unenrolled program in that account’s library. Generation and revisions never change the journal or enroll the user. Coaches can subsequently share their saved template using the existing invitation workflow.

The backend uses the official `@anthropic-ai/sdk` Messages API with a forced `submit_program_draft` tool call. This is not the Agent SDK. The tool returns a compact schedule and reusable templates; Buff validates them against the current user’s exercise catalog before displaying or saving. No browser API key or Claude subscription is needed.

## Worker configuration

Apply D1 migrations (`npm run db:migrate:remote`) and deploy (`npm run deploy`). Set the **buff** Worker secret `ANTHROPIC_API_KEY` in Cloudflare’s dashboard or using `node scripts/wrangler.js secret put ANTHROPIC_API_KEY`. Never commit the key or put it in a Vite/client variable. Local Worker development can use an untracked `.dev.vars` file. The Node/Express development server does not provide these Worker-only API routes.

Optional Worker variables:

| Variable | Default | Meaning |
| --- | --- | --- |
| `AI_PROGRAM_MODEL` | `claude-sonnet-4-6` | Supported models: this model, `claude-sonnet-4-5-20250929`, or `claude-haiku-4-5-20251001`. Other values disable generation. |
| `AI_PROGRAM_USER_DAILY_LIMIT` | `5` | Generation/revision attempts per user per UTC day; clamped to 1–20. |
| `AI_PROGRAM_DAILY_BUDGET_USD` | `5` | Shared daily reservation budget; 0 disables new attempts, maximum 100. |

Every provider attempt reserves **$0.50**, including failed attempts. Reservations are not refunded based on actual usage. Thus the default shared budget allows at most **10 attempts per day across the app**, with at most five per user. This conservative reservation is intentionally larger than the maximum estimated per-request cost at the supported models’ configured prices. It is not a credit balance or an Anthropic invoice forecast. Provider token counts and estimated actual cost are recorded separately in `ai_program_requests`. Review model pricing before updating the supported model list. Set Anthropic account spending limits as an additional safeguard.

Each attempt makes one provider request, with retries disabled, a 75-second timeout, at most 8,192 output tokens, and a 90 KB serialized input bound. Form submissions are limited to 16 KB. Atomic D1 reservations enforce user and shared budgets across concurrent requests. Saving/resuming drafts makes no Claude call and uses no allowance. Limits reset at midnight UTC; the UI shows the reset in the device’s local time. Missing secrets or unavailable capacity leave manual program creation available.

## Data and limits

Claude receives the form, current library exercise identifiers/names/tracking metadata (including personal library names), the draft, and recent revision messages. It does not receive account identity, email, date of birth, or private workout/program names and notes. Recent completed set values are included only when the user opts in; otherwise precise starting weights stay unassigned. User-entered form/chat text is sent as entered. Suggested loads use pounds and require matching recent history.

Drafts and conversations are private to the account and expire after 30 days. Bounded cleanup runs during generation. The preview and save use the same stored weight-history snapshot. Supported drafts have 1–52 numbered weeks, up to seven workouts per week, 14 reusable workout templates, ten exercises per template, and eight sets per exercise. Larger requests can exceed the response size/time limit and should be shortened. Saved programs remain subject to the existing 1 MB journal limit.

Saving uses journal revision checks, preserves existing plans/history/enrollment, and is idempotent. Concurrent revisions to one draft are rejected while it is being generated. Invalid or failed model output preserves the previous draft. Output is validated and rendered as escaped text. The browser cannot invoke arbitrary tools, select another user’s library, or send the API key to Claude directly.

## Verification

`npm test` covers authentication, private draft access, output validation, concurrency, budgets, opt-in history, official SDK request serialization, journal conflicts, and idempotent saving. `npm run test:worker -- ai-programs.spec.js` covers the mobile form/preview/revision/save flow with mocked provider results and the actual Worker/D1 save path. These tests do not spend Anthropic credits or create production accounts.
