import { test, expect } from "./auth-fixture.js";
test("new Google accounts must complete their profile and keep the birth date after reload", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  let completed = false;
  await page.route("**/api/auth/session", async (route) => {
    const response = await route.fetch();
    const result = await response.json();
    if (!completed && result.user) {
      result.user = {
        id: result.user.id,
        email: result.user.email,
        firstName: "Ana",
        lastName: "O’Neill",
        profileRequired: true,
      };
    }
    await route.fulfill({ response, json: result });
  });
  await page.route("**/api/auth/profile", async (route) => {
    const response = await route.fetch();
    if (response.ok()) completed = true;
    await route.fulfill({ response });
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Complete your profile", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("First Name", { exact: true })).toHaveValue(
    "Ana",
  );
  await expect(page.getByLabel("Last Name", { exact: true })).toHaveValue(
    "O’Neill",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Date of Birth", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  expect(completed).toBe(false);
  await page.getByLabel("Date of Birth", { exact: true }).fill("1988-03-22");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your account", exact: true }),
  ).toBeVisible();
  const session = await (await page.request.get("/api/auth/session")).json();
  expect(session.user).toMatchObject({
    firstName: "Ana",
    lastName: "O’Neill",
    dateOfBirth: "1988-03-22",
  });
  expect(session.user.profileRequired).toBeUndefined();
  await page.reload();
  await expect(page.locator(".sidebar")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Complete your profile", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
