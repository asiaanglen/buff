# In-app AI program creator

Signed-in users and coaches can choose **Programs → Create with AI** to open the chat popup without leaving their workspace. The Home banner opens the same popup. Older `/create-with-ai` links open Programs and expand the chatbot. Describe your goals in chat. Claude asks concise follow-up questions about missing training needs, then builds a draft. Review every numbered week and request changes in the same conversation. **Save program** creates a new, unenrolled program in that account’s library. Generation and revisions never change the journal or enroll the user. Coaches can subsequently share their saved template using the existing invitation workflow.

The backend uses the official `@anthropic-ai/sdk` Messages API with a choice of two tools: `ask_program_questions` for conversational replies and `submit_program_draft` for validated program previews. This is not the Agent SDK. The draft tool returns a compact schedule, inferred training preferences, and reusable templates; Buff validates them against the current user’s exercise catalog before displaying or saving. No browser API key or Claude subscription is needed.

The panel is a native component sharing the workspace’s authenticated session; it does not embed or navigate to another page. Messages scroll independently of the pinned composer. Program drafts appear as expandable attachments inside the transcript. The × button and Escape minimize the panel without destroying the chat or cancelling generation. The floating Buffy button reopens it. Successful conversations can also be resumed using the bottom-right conversation history icon after a reload. Signing out or changing accounts destroys the mounted chat and aborts browser requests. Saving synchronizes parent edits before updating the journal, then refreshes Programs and confirms in the conversation. Users must finish/close any unsaved editor before saving an AI program.

## Worker configuration

Apply D1 migrations (`npm run db:migrate:remote`) and deploy (`npm run deploy`). Set the **buff** Worker secret `ANTHROPIC_API_KEY` in Cloudflare’s dashboard or using `node scripts/wrangler.js secret put ANTHROPIC_API_KEY`. Never commit the key or put it in a Vite/client variable. Local Worker development can use an untracked `.dev.vars` file. The Node/Express development server does not provide these Worker-only API routes.

The optional Worker variable `AI_PROGRAM_MODEL` defaults to `claude-sonnet-4-6`. Supported alternatives are `claude-sonnet-4-5-20250929` and `claude-haiku-4-5-20251001`; other values disable generation.

There are **no app-enforced daily generation/revision limits or shared spending caps**. The former `AI_PROGRAM_USER_DAILY_LIMIT` and `AI_PROGRAM_DAILY_BUDGET_USD` variables are ignored, including if still configured on the Worker. Existing quota rows do not block requests. Provider token counts and estimated actual cost continue to be recorded in `ai_program_requests`; historical reservation tables remain for compatibility but new requests do not reserve funds. Actual charges are billed to the configured Anthropic API account. Anthropic account limits, credits, and provider rate limits still apply.

Each attempt makes one provider request, with retries disabled, a 75-second timeout, at most 8,192 output tokens, and a 90 KB serialized input bound. Message request bodies are limited to 16 KB; individual chat messages are limited to 2,000 characters. Saving/resuming drafts makes no Claude call. Missing secrets leave manual program creation available.

## Data and limits

Claude receives the conversation, inferred training preferences, current library exercise identifiers/names/tracking metadata (including personal library names), the draft, and recent revision messages. It does not receive account identity, email, date of birth, or private workout/program names and notes. Recent completed set values are included only when the user opts in; otherwise precise starting weights stay unassigned. User-entered chat text is sent as entered. Suggested loads use pounds and require matching recent history.

Conversations can be resumed before a draft exists. A program cannot be saved until a valid draft is ready. Drafts and conversations are private to the account and expire after 30 days. Bounded cleanup runs during generation. The preview and save use the same stored weight-history snapshot. Supported drafts have 1–52 numbered weeks, up to seven workouts per week, 14 reusable workout templates, ten exercises per template, and eight sets per exercise. Larger requests can exceed the response size/time limit and should be shortened. Saved programs remain subject to the existing 1 MB journal limit.

Saving uses journal revision checks, preserves existing plans/history/enrollment, and is idempotent. Concurrent revisions to one draft are rejected while it is being generated. Invalid or failed model output preserves the previous draft. Output is validated and rendered as escaped text. The browser cannot invoke arbitrary tools, select another user’s library, or send the API key to Claude directly.

## Verification

`npm test` covers authentication, private draft access, output validation, concurrency, generation beyond former daily caps, opt-in history, official SDK request serialization, journal conflicts, and idempotent saving. `npm run test:worker -- ai-programs.spec.js` covers the mobile chat/follow-up/preview/revision/save flow with mocked provider results and the actual Worker/D1 save path. These tests do not spend Anthropic credits or create production accounts.
