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
    await expect(
      page.getByRole("heading", {
        name: "Connect Buff to ChatGPT or Claude",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Buff connection URL", { exact: true }),
    ).toHaveValue(new URL("/mcp", page.url()).href);
    await expect(
      page.getByRole("heading", { name: "Connect with ChatGPT", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Connect with Claude", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Build your first program", { exact: true }),
    ).toContainText("approval link");
    await expect(
      page.getByLabel("Build a coach’s template", { exact: true }),
    ).toContainText("10-week");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.goto("/?tab=programs");
    const aiGuide = page.getByRole("link", {
      name: "Learn how to create programs with AI here",
      exact: false,
    });
    await expect(aiGuide).toBeVisible();
    await aiGuide.click();
    await expect(page).toHaveURL(/\/connections#ai-program-guide$/);
  }
});
