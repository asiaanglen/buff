import { fillSignupProfile } from "../signup-profile.js";
import { test, expect } from "@playwright/test";
test("two isolated devices share workouts, retain offline changes, and resolve conflicts explicitly", async ({
  browser,
}) => {
  const first = await browser.newContext();
  const second = await browser.newContext();
  const a = await first.newPage(),
    b = await second.newPage();
  const email = `sync-${Date.now()}@example.com`;
  async function auth(page, signup) {
    await page.goto("/app");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    if (signup)
      await page
        .getByRole("button", { name: "New to Buff? Create an account" })
        .click();
    if (signup) await fillSignupProfile(page);
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel(/^Password/).fill("workout journal password");
    await page
      .getByRole("button", {
        name: signup ? "Create account →" : "Sign in →",
        exact: true,
      })
      .click();
    await expect(page.locator("#account-root")).toContainText(email);
    await page.getByRole("button", { name: "Close account" }).click();
    await expect(page.locator("#sync-label")).toContainText("Synced");
  }
  async function add(page, name) {
    await page
      .getByRole("button", { name: "Plan a workout", exact: false })
      .first()
      .click();
    await page.getByLabel("Workout name").fill(name);
    await page.getByRole("button", { name: "Create workout" }).click();
  }
  try {
    await auth(a, true);
    await add(a, "Shared workout");
    await expect(a.locator("#sync-label")).toContainText("Synced");
    await auth(b, false);
    await expect(
      b.getByRole("heading", { name: "Shared workout", exact: true }),
    ).toBeVisible();
    await second.setOffline(true);
    await add(b, "Offline workout");
    await expect(b.locator("#sync-label")).toContainText("pending");
    await add(a, "Another device workout");
    await expect(a.locator("#sync-label")).toContainText("Synced");
    await second.setOffline(false);
    await b.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(b.locator("#sync-label")).toContainText("Sync conflict");
    await b.reload();
    await expect(b.locator("#sync-label")).toContainText("Sync conflict");
    await expect(
      b.getByRole("heading", { name: "Offline workout", exact: true }),
    ).toBeVisible();
    await b
      .getByRole("button", { name: "Account and cross-device sync" })
      .click();
    await expect(
      b.getByRole("button", { name: "Use cloud version" }),
    ).toBeVisible();
    b.once("dialog", (d) => d.accept());
    await b.getByRole("button", { name: "Use cloud version" }).click();
    await expect(b.locator("[data-sync-status]")).toHaveText("Synced");
    await b.getByRole("button", { name: "Close account" }).click();
    await expect(
      b.getByRole("heading", { name: "Another device workout", exact: true }),
    ).toBeVisible();
    await expect(
      b.getByRole("heading", { name: "Offline workout", exact: true }),
    ).toHaveCount(0);
    await b.reload();
    await expect(
      b.getByRole("heading", { name: "Shared workout", exact: true }),
    ).toBeVisible();
    await b
      .getByRole("button", { name: "Account and cross-device sync" })
      .click();
    await b.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(
      b.getByRole("heading", { name: "Shared workout", exact: true }),
    ).toHaveCount(0);
  } finally {
    await Promise.allSettled([first.close(), second.close()]);
  }
});
