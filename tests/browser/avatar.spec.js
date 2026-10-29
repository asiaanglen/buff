import { test, expect } from "./auth-fixture.js";
import { resolve } from "node:path";
test("users upload and remove a profile picture without losing profile drafts; the avatar syncs to another device", async ({
  page,
  browser,
  baseURL,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Account and cross-device sync", exact: true })
    .click();
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await page
    .getByLabel("First Name", { exact: true })
    .fill("Unsaved draft name");
  await page
    .getByLabel("Choose a profile picture", { exact: true })
    .setInputFiles(resolve("public/images/muscle-mami-logo.png"));
  await expect(page.locator(".account-message")).toHaveText(
    "Profile picture updated.",
  );
  await expect(page.getByLabel("First Name", { exact: true })).toHaveValue(
    "Unsaved draft name",
  );
  const image = page.locator(".profile .avatar img");
  await expect(image).toBeVisible();
  await expect
    .poll(() => image.evaluate((el) => el.complete && el.naturalWidth === 256))
    .toBe(true);
  const response = await page.request.get("/api/auth/avatar");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("image/jpeg");
  expect(response.headers()["cache-control"]).toContain("no-store");
  const metadata = await (await page.request.get("/api/auth/session")).json();
  expect(metadata.user.avatarVersion).toMatch(/^[a-f0-9]{32}$/);
  const phone = await browser.newContext({
    baseURL,
    storageState: { cookies: await page.context().cookies(), origins: [] },
    viewport: { width: 390, height: 844 },
  });
  try {
    const other = await phone.newPage();
    await other.goto("/");
    await other
      .getByRole("button", {
        name: "Account and cross-device sync",
        exact: true,
      })
      .click();
    await other
      .getByRole("button", { name: "Edit profile", exact: true })
      .click();
    await expect(other.locator(".profile-picture-preview img")).toBeVisible();
    await expect
      .poll(() =>
        other
          .locator(".profile-picture-preview img")
          .evaluate((el) => el.complete && el.naturalWidth === 256),
      )
      .toBe(true);
  } finally {
    await phone.close();
  }
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Remove picture", exact: true })
    .click();
  await expect(page.locator(".account-message")).toHaveText(
    "Profile picture removed.",
  );
  await expect(page.locator(".profile .avatar img")).toHaveCount(0);
  await expect(page.locator(".profile .avatar")).not.toBeEmpty();
  await expect(page.getByLabel("First Name", { exact: true })).toHaveValue(
    "Unsaved draft name",
  );
  expect((await page.request.get("/api/auth/avatar")).status()).toBe(404);
});
