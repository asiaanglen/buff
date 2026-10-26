# Enable Google sign-up and sign-in

Buff's Google integration is implemented but disabled until valid credentials are installed on the deployed Worker. No Google OAuth client has been created by this task, and real Google-account sign-in has not been validated. Unit tests verify signed identity tokens, state/nonce/PKCE handling, session creation and safe account linking with a simulated provider.

## Create the Google OAuth client

In your own Google Cloud project, open **Google Auth Platform** (or APIs & Services → Credentials):

1. Configure your app branding and consent audience. Request only `openid`, `email`, and `profile`.
2. Create an OAuth client of type **Web application**.
3. Add this authorized redirect URI exactly:

   ```text
   https://buff.asiaanglen.workers.dev/api/auth/google/callback
   ```

4. If the console asks for an authorized JavaScript origin, use:

   ```text
   https://buff.asiaanglen.workers.dev
   ```

5. Copy the client ID and client secret. In Testing mode, add the intended Google accounts as test users. For public sign-ups, configure the consent app for Production as required by Google; Google may require branding/domain verification for your chosen configuration.

No Google Cloud billing or paid Google APIs are required by Buff's basic OpenID sign-in flow. Google Cloud ownership, organizational policies, or consent-screen configuration can still require action in your account.

## Install the credentials securely

The deployed Cloudflare Worker needs `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Neither belongs in frontend code or the repository.

The simplest direct setup is **Cloudflare Dashboard → Workers & Pages → buff → Settings → Variables and Secrets**:

- Add `GOOGLE_CLIENT_ID` as a text variable (the public client ID).
- Add `GOOGLE_CLIENT_SECRET` as an encrypted secret.
- Save/deploy the configuration.

Alternatively, an authenticated operator can use `node scripts/wrangler.js secret put GOOGLE_CLIENT_ID` and `node scripts/wrangler.js secret put GOOGLE_CLIENT_SECRET`, entering the values securely when prompted. Never paste them into chat, command-line arguments, logs, or a committed file.

For assisted setup in this Codex environment, securely supply a `GOOGLE_CLIENT_ID` variable and `GOOGLE_CLIENT_SECRET` secret in environment settings. They must then be installed as Worker bindings; saving environment requirements alone does not configure the deployed app. Proxy-backed placeholders must be sent through their authorized HTTPS deployment route, not stored literally in the Worker or treated as raw credentials.

## Verify

`GET /api/auth/providers` returns `google: true` only when both Worker bindings are present. The sign-in and sign-up dialogs then show **Continue with Google** automatically. Complete a real Google sign-in, verify your workout account, and check sign-out/sign-in again before considering the integration live-tested. If you add a custom domain, update the registered redirect URI to that exact origin and use it consistently.

## Account safety

- New Google users get a private Buff account and a normal HttpOnly session; no Google access/refresh token is retained.
- Matching email addresses never silently link a Google account to an existing password account. Sign in with the existing Buff password, then use **Account → Connect Google to this account**. Linking requires both the starting Buff session and a successful Google identity check.
- Google-only accounts authenticate through Google. An already linked Google identity uses its stable Google subject ID, so changing its profile email does not create a second Buff account.
- The server verifies Google's RS256 signature, issuer, audience, verified email, expiry, nonce and PKCE-backed authorization-code flow, with a one-use browser-bound state record.
- Workouts and logs remain in the existing D1 account. Connecting Google does not replace them.
