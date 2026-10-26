import { test, expect } from "./auth-fixture.js";
test("plans workouts with supersets, logs reps and time, and persists after reload", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/app");
  await page
    .getByRole("button", { name: "Plan a workout", exact: false })
    .first()
    .click();
  await page.getByLabel("Workout name").fill("Leg day");
  await page.getByRole("button", { name: "Create workout" }).click();
  const card = page.locator(".workout-card").filter({
    has: page.getByRole("heading", { name: "Leg day", exact: true }),
  });
  async function add(name, mode, target) {
    await card.getByRole("button", { name: "Add exercise" }).click();
    await page.getByLabel("Exercise name").fill(name);
    await page.getByLabel("Sets", { exact: true }).fill("2");
    await page.getByLabel("Track by").selectOption(mode);
    await page.getByLabel("Target per set").fill(target);
    await page.getByLabel("Superset group").fill("A");
    await page
      .getByRole("button", { name: "Add exercise", exact: false })
      .last()
      .click();
  }
  await add("Squat", "reps", "8");
  await add("Wall sit", "time", "45");
  await expect(card.locator(".superset-label")).toHaveCount(1);
  await card.getByRole("button", { name: "Log workout" }).click();
  await page.getByLabel("Squat set 1 weight", { exact: true }).fill("50");
  await page.getByLabel("Squat set 1 reps", { exact: true }).fill("8");
  await page.getByLabel("Squat set 1 completed", { exact: true }).check();
  await page.getByLabel("Wall sit set 1 weight", { exact: true }).fill("0");
  await page.getByLabel("Wall sit set 1 seconds", { exact: true }).fill("40");
  await page.getByLabel("Wall sit set 1 completed", { exact: true }).check();
  await page.getByRole("button", { name: "Done logging" }).click();
  await expect(card).toContainText("2 sets completed");
  await page.reload();
  await page.getByRole("button", { name: "Workout history" }).click();
  await page
    .locator(".history-card")
    .filter({ hasText: "Leg day" })
    .getByRole("button", { name: "View log" })
    .click();
  await expect(
    page.getByLabel("Squat set 1 weight", { exact: true }),
  ).toHaveValue("50");
  await expect(
    page.getByLabel("Wall sit set 1 seconds", { exact: true }),
  ).toHaveValue("40");
  await expect(
    page.getByLabel("Wall sit set 1 completed", { exact: true }),
  ).toBeChecked();
  expect(errors).toEqual([]);
});
test("edits, reschedules, removes exercises and deletes workouts", async ({
  page,
}) => {
  await page.goto("/app");
  await page.getByRole("button", { name: "Edit Barbell bench press" }).click();
  await page.getByLabel("Sets", { exact: true }).fill("5");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.locator(".exercise-row").first()).toContainText("5 sets");
  await page.getByRole("button", { name: "Edit plan", exact: true }).click();
  await page.getByLabel("Workout name").fill("Updated workout");
  await page.getByLabel("Date", { exact: true }).fill("2026-11-04");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByRole("heading", { name: "Updated workout", exact: true }),
  ).toBeVisible();
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Edit Barbell bench press" }).click();
  await page.getByRole("button", { name: "Remove exercise" }).click();
  await expect(
    page.getByText("Barbell bench press", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Edit plan", exact: true }).click();
  await page
    .getByRole("button", { name: "Delete workout", exact: true })
    .click();
  await expect(page.locator(".workout-card")).toHaveCount(0);
});
test("mobile layout fits the screen and allows timed set logging", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Log workout" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("Plank set 1 weight", { exact: true }).fill("0");
  await page.getByLabel("Plank set 1 seconds", { exact: true }).fill("45");
  await page.getByLabel("Plank set 1 completed", { exact: true }).check();
  await page.getByRole("button", { name: "Done logging" }).click();
  await expect(page.locator(".workout-card")).toContainText("1 sets completed");
  await page.screenshot({ path: "/tmp/buff-mobile.png", fullPage: true });
});
test("desktop visual and no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/app");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "/tmp/buff-desktop.png", fullPage: true });
});
