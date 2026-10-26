import { test, expect } from "./auth-fixture.js";
test("mobile uses one page dropdown and clearly labeled set logging accordions", async ({
  page,
}) => {
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    const menu = page.getByRole("combobox", {
      name: "Go to page",
      exact: true,
    });
    await expect(menu).toBeVisible();
    await expect(menu).toHaveValue("planner");
    await expect(page.locator(".sidebar nav")).toBeHidden();
    await expect(menu.locator("option")).toHaveCount(5);
    for (const [tab, title] of [
      ["home", "Your next good workout."],
      ["programs", "Your next chapter."],
      ["history", "Completed workouts"],
      ["ai", "Connect to AI"],
      ["planner", "Your week, in motion."],
    ]) {
      await menu.selectOption(tab);
      await expect(
        page.getByRole("heading", { name: title, exact: true }),
      ).toBeVisible();
      await expect(menu).toHaveValue(tab);
    }
    await expect(page.locator(".exercise-log-hint")).toBeVisible();
    const control = page.locator('[data-action="expand-exercise"]').first();
    await expect(control).toContainText("Log sets");
    await page.screenshot({
      path: `/tmp/buff-mobile-navigation-${width}.png`,
      fullPage: false,
    });
    await control.click();
    const accordion = page.locator(".exercise-accordion").first();
    await expect(accordion.locator(".exercise-close-label")).toBeVisible();
    await expect(
      accordion.locator('[data-field="weight"]').first(),
    ).toBeVisible();
    await accordion.locator(".exercise-close-label").click();
    await expect(accordion.locator(".exercise-open-label")).toBeVisible();
    await expect(
      accordion.locator('[data-field="weight"]').first(),
    ).toBeHidden();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
