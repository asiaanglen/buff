import { identify } from "./session.js";
import { digest } from "./crypto.js";
import { usageOwner, readSmallUsageBody } from "./usage.js";
import { page, escape as esc, sameOrigin } from "./pages.js";
function setupPage(body, status = 200) {
  const result = page(
    "Enable usage monitoring",
    `${body}<script src="/usage-setup.js" defer></script>`,
    undefined,
    status,
  );
  const headers = new Headers(result.headers);
  headers.set(
    "Content-Security-Policy",
    "default-src 'none'; style-src 'self'; script-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
  );
  return new Response(result.body, { status: result.status, headers });
}
export async function usageSetup(request, env) {
  const user = await identify(request, env.DB);
  if (!user)
    return setupPage(
      '<p>Sign into the Buff account that should own the Usage dashboard, then return here to confirm.</p><a class="button" href="/?buff_return_to=%2Fusage%2Fsetup">Sign in to Buff</a>',
    );
  if (await usageOwner(env.DB, user.id))
    return Response.redirect(new URL("/usage#", request.url), 303);
  if (await env.DB.prepare("SELECT user_id FROM usage_owners LIMIT 1").first())
    return page(
      "Owner access required",
      "<p>The owner account has already been assigned.</p>",
      undefined,
      403,
    );
  if (request.method === "POST") {
    if (!sameOrigin(request))
      return page(
        "Request rejected",
        "<p>Open your private setup link again.</p>",
        undefined,
        403,
      );
    const text = await readSmallUsageBody(request);
    if (text === null)
      return page(
        "Invalid setup link",
        "<p>Open your private setup link again.</p>",
        undefined,
        400,
      );
    const token = new URLSearchParams(text).get("setupToken") || "";
    if (!/^[a-f0-9]{64}$/.test(token))
      return page(
        "Invalid setup link",
        "<p>Open your private setup link again.</p>",
        undefined,
        403,
      );
    const hash = await digest(token);
    const results = await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO usage_owners(user_id) SELECT ? WHERE EXISTS(SELECT 1 FROM usage_setup WHERE token_hash=? AND expires>?) AND NOT EXISTS(SELECT 1 FROM usage_owners)",
      ).bind(user.id, hash, Date.now()),
      env.DB.prepare(
        "DELETE FROM usage_setup WHERE EXISTS(SELECT 1 FROM usage_owners WHERE user_id=?)",
      ).bind(user.id),
    ]);
    if (!results[0].meta.changes)
      return page(
        "Setup link expired",
        "<p>This private setup link has expired or was already used. A new link must be issued by the app administrator.</p>",
        undefined,
        410,
      );
    return Response.redirect(new URL("/usage#", request.url), 303);
  }
  return setupPage(
    `<p>You are signed in as <strong>${esc(user.email)}</strong>.</p><p>Enable owner access for this account to view aggregate usage, storage warnings, and recent errors.</p><form method="post"><label id="setup-code-label">Owner setup code<input type="password" name="setupToken" required minlength="64" maxlength="64" autocomplete="off"></label><p id="setup-help">Open your private owner setup link to fill in the code.</p><button type="submit">Enable owner dashboard</button></form><p>If this is the wrong account, return to Buff and sign out before continuing.</p>`,
  );
}
