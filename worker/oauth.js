import {
  OAuthProvider,
  AuthorizationError,
  CimdFetchError,
} from "@cloudflare/workers-oauth-provider";
import { oauthStorage } from "./oauth-storage.js";
import { identify, sessionToken } from "./session.js";
import { digest } from "./crypto.js";
import { page, escape as esc, signIn, sameOrigin } from "./pages.js";
import { approvalPage, connectionsPage } from "./mcp/pages.js";
import { mcpHandler } from "./mcp/tools.js";
export async function handleOAuth(request, env, ctx, app) {
  if (env.PUBLIC_ORIGIN) {
    const external = new URL(env.PUBLIC_ORIGIN);
    const incoming = new URL(request.url);
    request = new Request(
      external.origin + incoming.pathname + incoming.search,
      request,
    );
  }
  const url = new URL(request.url),
    origin = url.origin;
  const oauthEnv = { ...env, OAUTH_KV: oauthStorage(env.DB) };
  const provider = new OAuthProvider({
    apiRoute: "/mcp",
    apiHandler: { fetch: mcpHandler },
    defaultHandler: {
      async fetch(req, e, c) {
        const path = new URL(req.url).pathname;
        if (path === "/oauth/authorize") return consent(req, e);
        if (path.startsWith("/approvals/")) return approvalPage(req, e);
        if (path === "/connections") return connectionsPage(req, e);
        return app.fetch(req, e, c);
      },
    },
    authorizeEndpoint: "/oauth/authorize",
    tokenEndpoint: "/oauth/token",
    clientRegistrationEndpoint: "/oauth/register",
    scopesSupported: ["buff:read", "buff:write", "offline_access"],
    requiredScopes: ["buff:read"],
    resourceMetadata: {
      resource: origin + "/mcp",
      authorization_servers: [origin],
      resource_name: "Buff workout journal",
    },
    clientIdMetadataDocumentEnabled: true,
    accessTokenTTL: 3600,
    refreshTokenTTL: 30 * 86400,
  });
  let oauthBody;
  if (
    ["/oauth/register", "/oauth/token"].includes(url.pathname) &&
    request.method === "POST"
  ) {
    const reader = request.body?.getReader();
    let size = 0;
    const chunks = [];
    if (reader)
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 16384) {
          await reader.cancel();
          return Response.json({ error: "invalid_request" }, { status: 413 });
        }
        chunks.push(value);
      }
    const bytes = new Uint8Array(size);
    let at = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, at);
      at += chunk.length;
    }
    oauthBody = new TextDecoder().decode(bytes);
    request = new Request(request, { body: oauthBody });
    ctx.waitUntil(
      env.DB.batch([
        env.DB.prepare(
          "DELETE FROM oauth_storage WHERE expires IS NOT NULL AND expires<=?",
        ).bind(Math.floor(Date.now() / 1000)),
        env.DB.prepare("DELETE FROM oauth_web_forms WHERE expires<=?").bind(
          Date.now(),
        ),
        env.DB.prepare("DELETE FROM auth_limits WHERE expires<=?").bind(
          Date.now(),
        ),
      ]),
    );
  }
  if (url.pathname === "/oauth/register" && request.method === "POST") {
    if (Number(request.headers.get("Content-Length") || 0) > 16384)
      return Response.json(
        { error: "invalid_client_metadata" },
        { status: 413 },
      );
    const bucket =
      "mcp-register:" +
      (await digest(
        (request.headers.get("CF-Connecting-IP") || "local") +
          ":" +
          Math.floor(Date.now() / 3600000),
      ));
    const result = await env.DB.prepare(
      "INSERT INTO auth_limits(bucket,attempts,expires) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET attempts=attempts+1 RETURNING attempts",
    )
      .bind(bucket, Date.now() + 3600000)
      .first();
    if (result.attempts > 30)
      return Response.json(
        { error: "Registration rate limit reached" },
        { status: 429 },
      );
  }
  if (url.pathname === "/mcp" || url.pathname.startsWith("/mcp/")) {
    const supplied = request.headers.get("Origin");
    if (
      supplied &&
      ![origin, "https://chatgpt.com", "https://chat.openai.com"].includes(
        supplied,
      )
    )
      return new Response("Origin not allowed", { status: 403 });
    if (request.method === "OPTIONS")
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": supplied || origin,
          "Access-Control-Allow-Methods": "POST,GET,DELETE,OPTIONS",
          "Access-Control-Allow-Headers":
            "Authorization,Content-Type,Accept,MCP-Protocol-Version,MCP-Session-Id",
          "Access-Control-Expose-Headers": "WWW-Authenticate,MCP-Session-Id",
        },
      });
  }
  let exchange;
  if (url.pathname === "/oauth/token" && request.method === "POST") {
    const text = oauthBody;
    if (text.length > 16384)
      return Response.json({ error: "invalid_request" }, { status: 413 });
    const form = new URLSearchParams(text),
      credential = form.get("code") || form.get("refresh_token");
    if (credential) {
      exchange = await digest(credential);
      await env.DB.prepare("DELETE FROM oauth_exchanges WHERE expires<?")
        .bind(Date.now())
        .run();
      const lock = await env.DB.prepare(
        "INSERT INTO oauth_exchanges(name,expires) VALUES(?,?) ON CONFLICT(name) DO NOTHING",
      )
        .bind(exchange, Date.now() + 30000)
        .run();
      if (!lock.meta.changes)
        return Response.json(
          {
            error: "invalid_grant",
            error_description: "This exchange is already being processed.",
          },
          { status: 400 },
        );
    }
  }
  try {
    return await provider.fetch(request, oauthEnv, ctx);
  } catch (e) {
    if (e instanceof AuthorizationError || e instanceof CimdFetchError)
      return page(
        "Connection request rejected",
        `<p>${esc(e instanceof AuthorizationError ? e.description : "The connecting app could not be verified.")}</p>`,
        undefined,
        400,
      );
    console.error("MCP request failed:", e.name);
    return page(
      "Connection unavailable",
      "<p>Please try again later.</p>",
      undefined,
      500,
    );
  } finally {
    if (exchange)
      await env.DB.prepare("DELETE FROM oauth_exchanges WHERE name=?")
        .bind(exchange)
        .run();
  }
}
async function consent(request, env) {
  const user = await identify(request, env.DB);
  const oauth = env.OAUTH_PROVIDER;
  if (request.method === "GET") {
    const auth = await oauth.parseAuthRequest(request);
    if (!auth.codeChallenge || auth.codeChallengeMethod !== "S256")
      return page(
        "Connection request rejected",
        "<p>This app must use PKCE with S256.</p>",
        undefined,
        400,
      );
    if (!user) return signIn(request);
    const details = await oauth.describeConsent(auth),
      consent = await oauth.beginConsent(auth);
    await env.DB.prepare(
      "INSERT INTO oauth_web_forms(id,user_id,session_hash,purpose,value,expires) VALUES(?,?,?,?,?,?)",
    )
      .bind(
        await digest(consent.handle),
        user.id,
        await digest(sessionToken(request)),
        "consent",
        "",
        Date.now() + 600000,
      )
      .run();
    return page(
      "Connect an app to Buff",
      `<p>Signed in as <strong>${esc(user.email)}</strong>.</p><h2>Allow ${esc(details.clientName)} to access Buff?</h2><p>${details.clientDomain ? `Published by <strong>${esc(details.clientDomain)}</strong>.` : "This app registered itself; its display name is not verified."}</p><p>Access will return to <strong>${esc(details.redirectHost)}</strong>.</p>${details.redirectIsLoopback ? '<p class="warning">This connects an app on your computer. Continue only if you started this connection.</p>' : ""}<form method="post"><input type="hidden" name="handle" value="${esc(consent.handle)}"><input type="hidden" name="scope" value="buff:read"><label><input type="checkbox" checked disabled> Read your workout programs and history</label><label><input type="checkbox" name="scope" value="buff:write" ${auth.scope.includes("buff:write") ? "checked" : ""}> Propose workout changes (each requires your approval in Buff)</label>${auth.scope.includes("offline_access") ? '<input type="hidden" name="scope" value="offline_access">' : ""}<p>Buff never shares your password. You can disconnect this app at any time.</p><button name="decision" value="approve">Connect app</button><button class="secondary" name="decision" value="deny">Cancel</button></form>`,
      consent.headers,
      200,
      auth.redirectUri,
    );
  }
  if (request.method === "POST") {
    if (!user)
      return page(
        "Sign-in expired",
        "<p>Restart the connection from your assistant and sign in again.</p>",
        undefined,
        401,
      );
    if (!sameOrigin(request))
      return page(
        "Request rejected",
        "<p>Open the connection page again.</p>",
        undefined,
        403,
      );
    const form = await request.formData(),
      handle = String(form.get("handle") || "");
    const bound = await env.DB.prepare(
      "DELETE FROM oauth_web_forms WHERE id=? AND user_id=? AND session_hash=? AND purpose='consent' AND expires>? RETURNING id",
    )
      .bind(
        await digest(handle),
        user.id,
        await digest(sessionToken(request)),
        Date.now(),
      )
      .first();
    if (!bound)
      return page(
        "Sign-in changed",
        "<p>Restart the connection in the same signed-in browser.</p>",
        undefined,
        403,
      );

    if (form.get("decision") !== "approve") {
      const denied = await oauth.denyConsent(request, handle);
      return new Response(null, { status: 302, headers: denied.headers });
    }
    const approved = await oauth.approveConsent(request, handle, {
        scope: form.getAll("scope").map(String),
      }),
      details = await oauth.describeConsent(approved.request);
    const { redirectTo } = await oauth.completeAuthorization({
      request: approved.request,
      userId: user.id,
      scope: approved.request.scope,
      metadata: { clientName: details.clientName },
      props: { userId: user.id, clientName: details.clientName },
    });
    approved.headers.set("Location", redirectTo);
    return new Response(null, { status: 302, headers: approved.headers });
  }
  return new Response("Method not allowed", { status: 405 });
}
