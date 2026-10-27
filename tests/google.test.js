import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { generateKeyPair, exportJWK, createLocalJWKSet, SignJWT } from "jose";
import {
  handleGoogle,
  verifyGoogleToken,
  safeGoogleReturn,
} from "../worker/google.js";
import { identify, issueSessionCookie } from "../worker/session.js";
import { testD1 } from "./support/d1.js";
const keys = await generateKeyPair("RS256");
const publicJwk = await exportJWK(keys.publicKey);
publicJwk.kid = "test-google";
const resolver = createLocalJWKSet({ keys: [publicJwk] });
const origin = "https://buff.test",
  client = "test-client.apps.googleusercontent.com";
async function token(nonce, claims = {}) {
  return new SignJWT({
    email: "person@example.com",
    email_verified: true,
    nonce,
    ...claims,
  })
    .setProtectedHeader({ alg: "RS256", kid: "test-google" })
    .setSubject(claims.sub || "google-subject")
    .setIssuer("https://accounts.google.com")
    .setAudience(claims.aud || client)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(keys.privateKey);
}
function setup() {
  const DB = testD1();
  DB.raw.exec(
    readFileSync(
      new URL("../migrations/0001_journal.sql", import.meta.url),
      "utf8",
    ),
  );
  DB.raw.exec(
    readFileSync(
      new URL("../migrations/0003_google_auth.sql", import.meta.url),
      "utf8",
    ),
  );
  DB.raw.exec(
    readFileSync(
      new URL("../migrations/0005_account_profiles.sql", import.meta.url),
      "utf8",
    ),
  );
  return { DB, GOOGLE_CLIENT_ID: client, GOOGLE_CLIENT_SECRET: "test-secret" };
}
function cookie(response) {
  return response.headers
    .getSetCookie()
    .find((c) => c.includes("buff_google_state="))
    ?.split(";")[0];
}
async function flow(
  env,
  { linkCookie = "", returnTo = "/", claims = {} } = {},
) {
  const start = await handleGoogle(
    new Request(
      origin +
        "/api/auth/google/" +
        (linkCookie ? "link" : "start") +
        "?return_to=" +
        encodeURIComponent(returnTo),
      {
        method: linkCookie ? "POST" : "GET",
        headers: { Cookie: linkCookie, Origin: origin },
      },
    ),
    env,
  );
  assert.equal(start.status, linkCookie ? 200 : 302);
  const to = new URL(
    linkCookie ? (await start.json()).url : start.headers.get("Location"),
  );
  return {
    to,
    stateCookie: cookie(start),
    callback:
      origin +
      "/api/auth/google/callback?" +
      new URLSearchParams({
        state: to.searchParams.get("state"),
        code: "test-code",
      }),
    deps: {
      fetcher: async (url, options) => {
        assert.equal(url, "https://oauth2.googleapis.com/token");
        const params = options.body;
        assert.equal(params.get("client_secret"), "test-secret");
        assert.equal(
          params.get("redirect_uri"),
          origin + "/api/auth/google/callback",
        );
        return Response.json({
          id_token: await token(to.searchParams.get("nonce"), claims),
        });
      },
      verify: (jwt, id) => verifyGoogleToken(jwt, id, resolver),
    },
  };
}
test("Google callback creates a session only after validating signed identity and consumes state once", async () => {
  const env = setup();
  try {
    const f = await flow(env, {
      returnTo: "/app",
      claims: { given_name: "Ana", family_name: "O’Neill" },
    });
    assert.equal(f.to.origin, "https://accounts.google.com");
    assert.equal(f.to.searchParams.get("code_challenge_method"), "S256");
    const result = await handleGoogle(
      new Request(f.callback, { headers: { Cookie: f.stateCookie } }),
      env,
      f.deps,
    );
    assert.equal(result.status, 303);
    assert.equal(result.headers.get("Location"), origin + "/app");
    const session = result.headers
      .getSetCookie()
      .find((c) => c.startsWith("buff_session="));
    assert.match(session, /HttpOnly/);
    assert.match(session, /Secure/);
    const user = await identify(
      new Request(origin, { headers: { Cookie: session.split(";")[0] } }),
      env.DB,
    );
    assert.equal(user.email, "person@example.com");
    assert.equal(user.firstName, "Ana");
    assert.equal(user.lastName, "O’Neill");
    assert.equal(user.profileRequired, true);
    assert.equal(user.dateOfBirth, undefined);
    assert.equal(
      env.DB.raw.prepare("SELECT COUNT(*) AS n FROM google_identities").get().n,
      1,
    );
    const replay = await handleGoogle(
      new Request(f.callback, { headers: { Cookie: f.stateCookie } }),
      env,
      f.deps,
    );
    assert.match(replay.headers.get("Location"), /google_failed/);
  } finally {
    env.DB.raw.close();
  }
});
test("Google identity verification rejects wrong audiences and unverified emails", async () => {
  const wrong = await token("nonce", { aud: "another-client" });
  await assert.rejects(() => verifyGoogleToken(wrong, client, resolver));
  const unverified = await token("nonce", { email_verified: false });
  await assert.rejects(() => verifyGoogleToken(unverified, client, resolver));
});
test("Google requires browser-bound state and a matching OIDC nonce", async () => {
  const env = setup();
  try {
    const f = await flow(env);
    let contacted = false;
    const wrongBrowser = await handleGoogle(
      new Request(f.callback, {
        headers: { Cookie: "__Host-buff_google_state=" + "0".repeat(64) },
      }),
      env,
      {
        ...f.deps,
        fetcher: async () => {
          contacted = true;
          throw Error();
        },
      },
    );
    assert.match(wrongBrowser.headers.get("Location"), /google_failed/);
    assert.equal(contacted, false);
    const wrongNonce = await flow(env, { claims: { nonce: "wrong-nonce" } });
    const callback = await handleGoogle(
      new Request(wrongNonce.callback, {
        headers: { Cookie: wrongNonce.stateCookie },
      }),
      env,
      wrongNonce.deps,
    );
    assert.match(callback.headers.get("Location"), /google_failed/);
    assert.equal(
      env.DB.raw.prepare("SELECT COUNT(*) AS n FROM users").get().n,
      0,
    );
  } finally {
    env.DB.raw.close();
  }
});
test("matching Google email never auto-links an existing password account; explicit signed-in linking preserves it", async () => {
  const env = setup();
  try {
    env.DB.raw
      .prepare("INSERT INTO users(id,email,password,salt) VALUES(?,?,?,?)")
      .run(
        "existing",
        "person@example.com",
        "existing-verifier",
        "existing-salt",
      );
    const f = await flow(env);
    const refused = await handleGoogle(
      new Request(f.callback, { headers: { Cookie: f.stateCookie } }),
      env,
      f.deps,
    );
    assert.match(refused.headers.get("Location"), /google_account_exists/);
    assert.equal(
      env.DB.raw.prepare("SELECT COUNT(*) AS n FROM google_identities").get().n,
      0,
    );
    const session = (
      await issueSessionCookie(new Request(origin), env.DB, { id: "existing" })
    ).split(";")[0];
    const link = await flow(env, { linkCookie: session });
    const linked = await handleGoogle(
      new Request(link.callback, {
        headers: { Cookie: session + "; " + link.stateCookie },
      }),
      env,
      link.deps,
    );
    assert.equal(linked.status, 303);
    assert.equal(
      env.DB.raw.prepare("SELECT user_id FROM google_identities").get().user_id,
      "existing",
    );
    assert.equal(
      env.DB.raw
        .prepare("SELECT password FROM users WHERE id=?")
        .get("existing").password,
      "existing-verifier",
    );
  } finally {
    env.DB.raw.close();
  }
});
test("Google return destinations cannot leave Buff, and changed linking sessions are rejected", async () => {
  assert.equal(safeGoogleReturn("https://evil.example", origin), "/");
  assert.equal(safeGoogleReturn("//evil.example", origin), "/");
  assert.equal(
    safeGoogleReturn("/oauth/authorize?client_id=test", origin),
    "/oauth/authorize?client_id=test",
  );
  const env = setup();
  try {
    env.DB.raw
      .prepare("INSERT INTO users(id,email,password,salt) VALUES(?,?,?,?)")
      .run("existing", "person@example.com", "existing-verifier", "salt");
    const session = (
      await issueSessionCookie(new Request(origin), env.DB, { id: "existing" })
    ).split(";")[0];
    const link = await flow(env, { linkCookie: session });
    const result = await handleGoogle(
      new Request(link.callback, { headers: { Cookie: link.stateCookie } }),
      env,
      link.deps,
    );
    assert.match(result.headers.get("Location"), /google_session_changed/);
    assert.equal(
      env.DB.raw.prepare("SELECT COUNT(*) AS n FROM google_identities").get().n,
      0,
    );
  } finally {
    env.DB.raw.close();
  }
});

test("Google sign-in returns directly to an invitation URL without dropping its token", async () => {
  const env = setup();
  const target = "/?invite=" + "a".repeat(64);
  const f = await flow(env, { returnTo: target });
  const response = await handleGoogle(
    new Request(f.callback, { headers: { Cookie: f.stateCookie } }),
    env,
    f.deps,
  );
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("Location"), origin + target);
});
