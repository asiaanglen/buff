import { test, expect } from "./auth-fixture.js";
test("phone UI uses readable exercise cards, full-size inputs and accessible tap targets", async ({
  page,
}) => {
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await expect(page.locator(".sidebar")).toBeVisible();
    expect(
      await page
        .locator(".exercise-name strong")
        .first()
        .evaluate((e) => parseFloat(getComputedStyle(e).fontSize)),
    ).toBeGreaterThanOrEqual(16);
    expect(
      await page
        .locator('[data-action="log"]')
        .first()
        .evaluate((e) => e.getBoundingClientRect().height),
    ).toBeGreaterThanOrEqual(44);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.locator('[data-action="log"]').first().click();
    const field = page.locator('.log-row [data-field="weight"]').first();
    expect(
      await field.evaluate((e) => parseFloat(getComputedStyle(e).fontSize)),
    ).toBeGreaterThanOrEqual(16);
    expect(
      await field.evaluate((e) => e.getBoundingClientRect().height),
    ).toBeGreaterThanOrEqual(44);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `/tmp/buff-mobile-log-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Collapse workout" }).click();
    await page.screenshot({
      path: `/tmp/buff-mobile-workout-${width}.png`,
      fullPage: true,
    });
  }
});
