import { test, expect } from "./auth-fixture.js";
test("signed-in startup stays on a loading screen until the private journal is ready", async ({
  page,
}) => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  await page.route("**/api/state", async (route) => {
    if (route.request().method() === "GET") {
      await gate;
    }
    await route.continue();
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Loading Buff", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".landing")).toHaveCount(0);
  await expect(page.locator(".sidebar")).toHaveCount(0);
  await page.screenshot({ path: "/tmp/buff-loading.png" });
  release();
  await expect(
    page.getByRole("heading", { name: "Your week, in motion.", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".landing")).toHaveCount(0);
});
test("anonymous startup shows loading before the landing page and connection errors can be retried", async ({
  page,
  baseURL,
}) => {
  await page.request.post("/api/auth/signout", {
    headers: { Origin: baseURL },
    data: {},
  });
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  await page.route("**/api/auth/session", async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Loading Buff", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".landing")).toHaveCount(0);
  release();
  await expect(
    page.getByRole("heading", {
      name: "Your next chapter starts with a plan.",
      exact: true,
    }),
  ).toBeVisible();
  await page.unroute("**/api/auth/session");
  await page.route("**/api/auth/session", (route) => route.abort());
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Couldn’t load Buff", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".landing")).toHaveCount(0);
  await page.unroute("**/api/auth/session");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Your next chapter starts with a plan.",
      exact: true,
    }),
  ).toBeVisible();
});
