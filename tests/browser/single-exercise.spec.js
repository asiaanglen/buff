import { test, expect } from "./auth-fixture.js";
test("Start workout opens one exercise at a time and preserves logged values when switching", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Log workout", exact: false }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Start workout", exact: false })
    .click();
  const exercises = page.locator(".exercise-accordion");
  const first = exercises.nth(0),
    second = exercises.nth(1);
  await expect(page.locator(".exercise-accordion[open]")).toHaveCount(1);
  await expect(first).toHaveAttribute("open", "");
  await page
    .getByLabel("Barbell bench press set 1 weight", { exact: true })
    .fill("95");
  await page
    .getByLabel("Barbell bench press set 1 reps", { exact: true })
    .fill("9");
  await page
    .getByLabel("Barbell bench press set 1 completed", { exact: true })
    .check();
  await page
    .getByLabel("Notes for Barbell bench press", { exact: true })
    .fill("Keep the same grip.");
  await second.locator("h3").click();
  await expect(page.locator(".exercise-accordion[open]")).toHaveCount(1);
  await expect(first).not.toHaveAttribute("open", "");
  await expect(second).toHaveAttribute("open", "");
  await expect(
    page.getByLabel("Barbell bench press set 1 weight", { exact: true }),
  ).toBeHidden();
  await expect(
    page.getByLabel("Single-arm dumbbell row set 1 weight", { exact: true }),
  ).toBeVisible();
  await first.locator("h3").click();
  await expect(page.locator(".exercise-accordion[open]")).toHaveCount(1);
  await expect(
    page.getByLabel("Barbell bench press set 1 weight", { exact: true }),
  ).toHaveValue("95");
  await expect(
    page.getByLabel("Barbell bench press set 1 reps", { exact: true }),
  ).toHaveValue("9");
  await expect(
    page.getByLabel("Barbell bench press set 1 completed", { exact: true }),
  ).toBeChecked();
  await expect(
    page.getByLabel("Notes for Barbell bench press", { exact: true }),
  ).toHaveValue("Keep the same grip.");
  await page
    .getByRole("button", {
      name: "Add set to Barbell bench press",
      exact: true,
    })
    .click();
  await expect(page.locator(".exercise-accordion[open]")).toHaveCount(1);
  await expect(
    page.getByLabel("Barbell bench press set 5 reps", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("#sync-label")).toContainText("Synced");
});
