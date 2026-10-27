import { test, expect } from "./auth-fixture.js";
test("navigation omits Connect to AI while account still opens connected app management", async ({
  page,
}) => {
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await expect(page.locator(".sidebar")).toBeVisible();
    await expect(page.locator('[data-tab="ai"]')).toHaveCount(0);
    await expect(
      page.locator('#mobile-page-select option[value="ai"]'),
    ).toHaveCount(0);
    await page
      .getByRole("button", {
        name: "Account and cross-device sync",
        exact: true,
      })
      .click();
    const manage = page.getByRole("link", {
      name: "Manage connected AI apps",
      exact: false,
    });
    await expect(manage).toBeVisible();
    await expect(manage).toHaveAttribute("href", "/connections");
    await manage.click();
    await expect(page).toHaveURL(/\/connections$/);
    await expect(
      page.getByRole("heading", { name: "Connected apps", exact: true }),
    ).toBeVisible();
  }
});
