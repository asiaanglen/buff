import { test, expect } from "./auth-fixture.js";
test("users can submit a private bug report from Account on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Account and cross-device sync", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Give feedback / Report a bug", exact: false })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Give feedback / Report a bug",
      exact: false,
    }),
  ).toBeVisible();
  await page
    .getByLabel("What would you like to share?", { exact: true })
    .selectOption("bug");
  await page
    .getByLabel("Your feedback or what went wrong", { exact: true })
    .fill("Timer button is difficult to find on my phone.");
  await page
    .getByLabel("Steps to reproduce", { exact: false })
    .fill("Open a workout, expand the timed exercise.");
  await page
    .getByLabel("Include browser/device details", { exact: false })
    .uncheck();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Send feedback", exact: true })
    .click();
  await expect(page).toHaveURL(/\/feedback\/thanks$/);
  await expect(page.getByRole("status")).toContainText(
    "private feedback inbox",
  );
  const response = await page.request.get("/feedback/inbox");
  expect(response.status()).toBe(404);
  expect(await response.text()).not.toContain("Timer button is difficult");
});
