import { test, expect } from "@playwright/test";
import { passwordProof, authScheme } from "../../src/credentials.js";
import { initialState } from "../../src/model.js";
test("D1 API authenticates users, isolates data, enforces origin and rejects stale updates", async ({
  request,
  baseURL,
}) => {
  const email = `api-${Date.now()}@example.com`,
    password = await passwordProof(email, "a long secure password");
  const headers = { Origin: baseURL };
  expect((await request.get("/api/state")).status()).toBe(401);
  const signup = await request.post("/api/auth/signup", {
    headers,
    data: { email, password, credentialVersion: authScheme },
  });
  expect(signup.status()).toBe(200);
  expect(signup.headers()["set-cookie"]).toContain("HttpOnly");
  expect((await request.get("/api/auth/session")).ok()).toBeTruthy();
  const state = initialState();
  state.workouts[0].exercises[0].logs[0] = {
    weight: "40",
    actual: "8",
    done: true,
  };
  expect(
    (
      await request.put("/api/state", { headers, data: { state, revision: 0 } })
    ).status(),
  ).toBe(200);
  const loaded = await (await request.get("/api/state")).json();
  expect(loaded.state).toEqual(state);
  expect(loaded.revision).toBe(1);
  expect(
    (
      await request.put("/api/state", { headers, data: { state, revision: 0 } })
    ).status(),
  ).toBe(409);
  expect(
    (
      await request.put("/api/state", {
        headers: { Origin: "https://evil.example" },
        data: { state, revision: 1 },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.put("/api/state", {
        headers,
        data: {
          state: { version: 1, unit: "kg", workouts: [{}] },
          revision: 1,
        },
      })
    ).status(),
  ).toBe(400);
  await request.post("/api/auth/signout", { headers, data: {} });
  expect((await request.get("/api/state")).status()).toBe(401);
  expect(
    (
      await request.post("/api/auth/signin", {
        headers,
        data: {
          email,
          password: "0".repeat(64),
          credentialVersion: authScheme,
        },
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await request.post("/api/auth/signin", {
        headers,
        data: { email, password, credentialVersion: authScheme },
      })
    ).status(),
  ).toBe(200);
  expect((await (await request.get("/api/state")).json()).state).toEqual(state);
  await request.post("/api/auth/signout", { headers, data: {} });
  const other = `other-${Date.now()}@example.com`;
  expect(
    (
      await request.post("/api/auth/signup", {
        headers,
        data: {
          email: other,
          password: await passwordProof(other, "another long password"),
          credentialVersion: authScheme,
        },
      })
    ).status(),
  ).toBe(200);
  expect((await (await request.get("/api/state")).json()).state).toBeNull();
});
test("browser sends a stretched credential, never the raw password, to the Worker", async ({
  page,
}) => {
  const raw = "never send this password";
  let submitted;
  page.on("request", (r) => {
    if (r.url().endsWith("/api/auth/signup")) submitted = r.postDataJSON();
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Account and cross-device sync" })
    .click();
  await page
    .getByRole("button", { name: "New to Buff? Create an account" })
    .click();
  const email = `proof-${Date.now()}@example.com`;
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel(/^Password/).fill(raw);
  await page
    .getByRole("button", { name: "Create account →", exact: true })
    .click();
  await expect(page.locator("#account-root")).toContainText(email);
  expect(submitted.password).not.toBe(raw);
  expect(submitted.credentialVersion).toBe(authScheme);
  expect(submitted.password).toBe(await passwordProof(email, raw));
});
