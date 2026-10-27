import { test, expect } from "./auth-fixture.js";
import { passwordProof, authScheme } from "../../src/credentials.js";
import { exercise } from "../../src/model.js";
async function owner(browser, baseURL, width = 390) {
  const context = await browser.newContext({
    baseURL,
    viewport: { width, height: 844 },
    extraHTTPHeaders: {
      "CF-Connecting-IP": `198.19.253.${Math.floor(Math.random() * 200) + 1}`,
    },
  });
  const email = "usage-owner@example.test";
  const result = await context.request.post("/api/auth/signin", {
    headers: { Origin: baseURL },
    data: {
      email,
      password: await passwordProof(email, "usage-owner-only-test-password"),
      credentialVersion: authScheme,
    },
  });
  expect(result.ok()).toBeTruthy();
  expect((await result.json()).user.isUsageOwner).toBe(true);
  return context;
}
const events = (summary, name) =>
  summary.events
    .filter((row) => row.event === name)
    .reduce((sum, row) => sum + row.count, 0);
async function summary(context) {
  const response = await context.request.get("/api/admin/usage");
  expect(response.status()).toBe(200);
  return response.json();
}
test("only explicitly assigned owners can view the usage dashboard or its API", async ({
  page,
  browser,
  baseURL,
}) => {
  const user = (await (await page.request.get("/api/auth/session")).json())
    .user;
  expect(user.isUsageOwner).toBeUndefined();
  expect(
    (
      await page.request.get("/api/admin/usage", {
        headers: { "X-Usage-Owner": "true" },
      })
    ).status(),
  ).toBe(403);
  await page.goto("/");
  await page
    .getByRole("button", { name: "Account and cross-device sync", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Usage dashboard", exact: false }),
  ).toHaveCount(0);
  const denied = await page.goto("/usage");
  expect(denied.status()).toBe(403);
  await expect(
    page.getByRole("heading", { name: "Owner access required", exact: true }),
  ).toBeVisible();
  const anonymous = await browser.newContext({ baseURL });
  expect((await anonymous.request.get("/api/admin/usage")).status()).toBe(401);
  await anonymous.close();
  const context = await owner(browser, baseURL, 320),
    dashboard = await context.newPage();
  await dashboard.goto("/");
  await dashboard
    .getByRole("button", { name: "Account and cross-device sync", exact: true })
    .click();
  await dashboard
    .getByRole("link", { name: "Usage dashboard", exact: false })
    .click();
  await expect(
    dashboard.getByRole("heading", { name: "Usage dashboard", exact: true }),
  ).toBeVisible();
  await expect(
    dashboard.getByText("sampled estimate", { exact: false }).first(),
  ).toBeVisible();
  expect(
    await dashboard.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await dashboard.screenshot({
    path: "/tmp/buff-usage-dashboard-mobile.png",
    fullPage: true,
  });
  const response = await context.request.get("/api/admin/usage");
  expect(response.headers()["cache-control"]).toBe("no-store");
  expect(JSON.stringify(await response.json())).not.toContain(user.email);
  await context.close();
});
test("successful completions and failed sign-ins are counted without recording workout details", async ({
  page,
  browser,
  baseURL,
}) => {
  const context = await owner(browser, baseURL);
  const initial = await summary(context);
  const entry = exercise("Back Squat", 1, 5, "reps", 95),
    state = {
      version: 1,
      unit: "lbs",
      programs: [],
      workouts: [
        {
          id: "private-workout-id",
          name: "PRIVATE WORKOUT NAME",
          date: "2026-10-26",
          note: "PRIVATE WORKOUT NOTE",
          exercises: [entry],
        },
      ],
    };
  const headers = { Origin: baseURL };
  expect(
    (
      await page.request.put("/api/state", {
        headers,
        data: { state, revision: 0 },
      })
    ).ok(),
  ).toBeTruthy();
  state.workouts[0].exercises[0].logs[0] = {
    weight: "100",
    actual: "5",
    done: true,
  };
  expect(
    (
      await page.request.put("/api/state", {
        headers,
        data: { state, revision: 1 },
      })
    ).ok(),
  ).toBeTruthy();
  expect(
    (
      await page.request.put("/api/state", {
        headers,
        data: { state, revision: 2 },
      })
    ).ok(),
  ).toBeTruthy();
  const user = (await (await page.request.get("/api/auth/session")).json())
    .user;
  expect(
    (
      await page.request.post("/api/auth/signin", {
        headers,
        data: {
          email: user.email,
          password: await passwordProof(user.email, "wrong password"),
          credentialVersion: authScheme,
        },
      })
    ).status(),
  ).toBe(401);
  await expect
    .poll(async () => events(await summary(context), "workout_completed"))
    .toBe(events(initial, "workout_completed") + 1);
  await expect
    .poll(async () => events(await summary(context), "signin_failure"))
    .toBeGreaterThan(events(initial, "signin_failure"));
  const data = JSON.stringify(await summary(context));
  for (const value of [
    user.email,
    "PRIVATE WORKOUT NAME",
    "PRIVATE WORKOUT NOTE",
    "private-workout-id",
  ])
    expect(data).not.toContain(value);
  await context.close();
});
test("offline sync reports are sent after recovery, contain only event identifiers, and deduplicate retries", async ({
  page,
  browser,
  baseURL,
}) => {
  const context = await owner(browser, baseURL),
    before = await summary(context);
  await page.goto("/");
  await expect(page.locator("#sync-label")).toContainText("Synced");
  await page
    .getByRole("button", { name: "Start workout", exact: false })
    .click();
  await page.context().setOffline(true);
  await page
    .getByLabel("Barbell bench press set 1 weight", { exact: true })
    .fill("50");
  await page
    .getByLabel("Barbell bench press set 1 reps", { exact: true })
    .fill("7");
  await page
    .getByLabel("Barbell bench press set 1 reps", { exact: true })
    .blur();
  await expect(page.locator("#sync-label")).toContainText("Offline");
  let report;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/usage/events"))
      report = request.postDataJSON();
  });
  await page.context().setOffline(false);
  await expect(page.locator("#sync-label")).toContainText("Synced");
  await expect
    .poll(async () => events(await summary(context), "sync_network_failure"))
    .toBe(events(before, "sync_network_failure") + 1);
  expect(Object.keys(report).sort()).toEqual(["event", "id"]);
  expect(
    (
      await page.request.post("/api/usage/events", {
        headers: { Origin: baseURL },
        data: report,
      })
    ).ok(),
  ).toBeTruthy();
  expect(events(await summary(context), "sync_network_failure")).toBe(
    events(before, "sync_network_failure") + 1,
  );
  const rejected = await page.request.post("/api/usage/events", {
    headers: { Origin: baseURL },
    data: { ...report, email: "must-not-collect@example.com" },
  });
  expect(rejected.status()).toBe(400);
  await context.close();
});
test("large journals show a private warning to the user and an aggregate owner warning", async ({
  page,
  browser,
  baseURL,
}) => {
  const state = { version: 1, unit: "lbs", programs: [], workouts: [] };
  let size = 0;
  while (size < 780000) {
    const index = state.workouts.length,
      entry = exercise("Back Squat", 1, 5, "reps", 95);
    entry.note = "n".repeat(1000);
    state.workouts.push({
      id: "large-" + index,
      name: "History " + index,
      date: "2026-01-01",
      note: "w".repeat(500),
      exercises: [entry],
    });
    size = new TextEncoder().encode(JSON.stringify(state)).byteLength;
  }
  expect(size).toBeLessThan(1048576);
  expect(
    (
      await page.request.put("/api/state", {
        headers: { Origin: baseURL },
        data: { state, revision: 0 },
      })
    ).ok(),
  ).toBeTruthy();
  await page.goto("/");
  await expect(page.locator(".journal-storage-warning").first()).toContainText(
    "approaching the 1 MB sync limit",
  );
  const context = await owner(browser, baseURL),
    data = await summary(context);
  expect(data.journals.near_limit).toBeGreaterThanOrEqual(1);
  expect(data.journals.largest_journal).toBeGreaterThanOrEqual(780000);
  await context.close();
});

test("private owner links keep setup codes out of requests and return through Buff sign-in", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL,
    extraHTTPHeaders: {
      "CF-Connecting-IP": `198.19.252.${Math.floor(Math.random() * 200) + 1}`,
    },
  });
  const page = await context.newPage(),
    token = "f".repeat(64),
    urls = [];
  page.on("request", (request) => urls.push(request.url()));
  await page.goto("/usage/setup#setup=" + token);
  await expect(page).toHaveURL(baseURL + "/usage/setup");
  expect(
    await page.evaluate(() => sessionStorage.getItem("buff-usage-owner-setup")),
  ).toBe(token);
  expect(urls.some((url) => url.includes(token))).toBe(false);
  await page
    .getByRole("link", { name: "Sign in to Buff", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Sign in to Buff", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Email", { exact: true })
    .fill("usage-owner@example.test");
  await page.getByLabel(/^Password/).fill("usage-owner-only-test-password");
  await page.getByRole("button", { name: "Sign in →", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Usage dashboard", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => sessionStorage.getItem("buff-usage-owner-setup")),
  ).toBeNull();
  expect(urls.some((url) => url.includes(token))).toBe(false);
  await context.close();
});
