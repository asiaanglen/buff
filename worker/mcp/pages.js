import { identify, sessionToken } from "../session.js";
import { randomHex, digest } from "../crypto.js";
import { page, escape as esc, signIn, sameOrigin } from "../pages.js";
export async function approvalPage(request, env) {
  const user = await identify(request, env.DB);
  if (!user) return signIn(request);
  const id = new URL(request.url).pathname.split("/")[2];
  if (!/^[a-f0-9]{64}$/.test(id))
    return page(
      "Change not found",
      "<p>This change is not available.</p>",
      undefined,
      404,
    );
  const row = await env.DB.prepare(
    "SELECT * FROM mcp_approvals WHERE id=? AND user_id=?",
  )
    .bind(id, user.id)
    .first();
  if (!row)
    return page(
      "Change not found",
      "<p>This change is not available in your account.</p>",
      undefined,
      404,
    );
  if (row.status !== "pending")
    return page(
      row.status === "applied" ? "Change applied" : "Change rejected",
      `<p>${esc(row.summary)}</p><p>Your journal is safe to reopen in Buff.</p>`,
    );
  if (row.expires < Date.now())
    return page(
      "Change expired",
      "<p>Ask your assistant to prepare a fresh proposal. Nothing was changed.</p>",
      undefined,
      410,
    );
  if (request.method === "POST") {
    if (!sameOrigin(request))
      return page(
        "Request rejected",
        "<p>Open the approval page again.</p>",
        undefined,
        403,
      );
    const form = await request.formData(),
      csrf = String(form.get("csrf") || "");
    if (
      (await digest(csrf)) !== row.csrf_hash ||
      (await digest(sessionToken(request))) !== row.session_hash
    )
      return page(
        "Request rejected",
        "<p>Open the approval link again in this signed-in browser.</p>",
        undefined,
        403,
      );
    const status = form.get("decision") === "approve" ? "applied" : "rejected";
    try {
      const result = await env.DB.prepare(
        "UPDATE mcp_approvals SET status=?,csrf_hash=NULL,session_hash=NULL WHERE id=? AND user_id=? AND status='pending' AND expires>? AND csrf_hash=? AND session_hash=?",
      )
        .bind(status, id, user.id, Date.now(), row.csrf_hash, row.session_hash)
        .run();
      if (!result.meta.changes)
        return page(
          "Already handled",
          "<p>This approval expired or was already used.</p>",
          undefined,
          409,
        );
    } catch (e) {
      if (String(e.message).includes("Journal changed"))
        return page(
          "Your journal changed",
          "<p>This proposal was not applied because another device or request changed your journal. Ask your assistant to read the latest data and prepare a new proposal.</p>",
          undefined,
          409,
        );
      throw e;
    }
    return page(
      status === "applied" ? "Change applied" : "Change rejected",
      `<p>${esc(row.summary)}</p><p>${status === "applied" ? "Your changes are saved and will sync to your devices." : "Your workouts were not changed."}</p>`,
    );
  }
  if (request.method !== "GET")
    return new Response("Method not allowed", { status: 405 });
  const csrf = randomHex();
  await env.DB.prepare(
    "UPDATE mcp_approvals SET csrf_hash=?,session_hash=? WHERE id=? AND status='pending'",
  )
    .bind(await digest(csrf), await digest(sessionToken(request)), id)
    .run();
  return page(
    "Review workout changes",
    `<p>Signed in as <strong>${esc(user.email)}</strong>.</p><h2>${esc(row.summary)}</h2><p>Proposed by <strong>${esc(row.client_name)}</strong>.</p><p>Your assistant proposed the following changes. They have not been applied. Weights in this preview are in ${JSON.parse(row.proposal).unit === "kg" ? "kilograms (an older proposal; Buff will display converted pounds)" : "pounds (lbs)"}.</p><pre>${esc(row.preview)}</pre><p class="badge">Expires ${new Date(row.expires).toISOString()}. If your journal changes first, this proposal cannot overwrite it.</p><form method="post"><input type="hidden" name="csrf" value="${csrf}"><button name="decision" value="approve">Approve changes</button><button class="secondary" name="decision" value="reject">Reject</button></form>`,
  );
}
export async function connectionsPage(request, env) {
  const user = await identify(request, env.DB);
  if (!user) return signIn(request);
  if (request.method === "POST") {
    if (!sameOrigin(request))
      return page(
        "Request rejected",
        "<p>Open this page again.</p>",
        undefined,
        403,
      );
    const form = await request.formData();
    const row = await env.DB.prepare(
      "DELETE FROM oauth_web_forms WHERE id=? AND user_id=? AND session_hash=? AND purpose='revoke' AND expires>? RETURNING value",
    )
      .bind(
        await digest(String(form.get("csrf") || "")),
        user.id,
        await digest(sessionToken(request)),
        Date.now(),
      )
      .first();
    if (!row)
      return page(
        "Request rejected",
        "<p>The form expired. Open Connected apps again.</p>",
        undefined,
        403,
      );
    const grant = JSON.parse(row.value);
    await env.OAUTH_PROVIDER.revokeGrant(grant.grantId, user.id);
    await env.DB.prepare(
      "UPDATE mcp_approvals SET status='rejected',csrf_hash=NULL,session_hash=NULL WHERE user_id=? AND client_id=? AND status='pending'",
    )
      .bind(user.id, grant.clientId)
      .run();
    return Response.redirect(new URL("/connections", request.url), 303);
  }
  const grants = await env.OAUTH_PROVIDER.listUserGrants(user.id, {
    limit: 20,
  });
  const items = [];
  for (const g of grants.items) {
    const csrf = randomHex();
    await env.DB.prepare(
      "INSERT INTO oauth_web_forms(id,user_id,session_hash,purpose,value,expires) VALUES(?,?,?,?,?,?)",
    )
      .bind(
        await digest(csrf),
        user.id,
        await digest(sessionToken(request)),
        "revoke",
        JSON.stringify({ grantId: g.id, clientId: g.clientId }),
        Date.now() + 10 * 60000,
      )
      .run();
    items.push(
      `<div class="connection"><h2>${esc(g.metadata?.clientName || "Connected MCP app")}</h2><p>${esc(g.scope.join(", "))}</p><p class="badge">${esc(g.redirectUri || "")}</p><form method="post"><input type="hidden" name="csrf" value="${csrf}"><button class="secondary">Disconnect app</button></form></div>`,
    );
  }
  return page(
    "Connected apps",
    `<p>Signed in as <strong>${esc(user.email)}</strong>. Disconnecting revokes this app’s access to your workout journal.</p>${items.join("") || "<p>No apps are connected.</p>"}`,
  );
}
