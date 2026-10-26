import { test, expect } from "./auth-fixture.js";
import { exercise, key } from "../../src/model.js";
test("creates and edits multiple supersets without losing logs or notes; logs show grouping and no Done logging button", async ({
  page,
  baseURL,
}) => {
  const workout = {
    id: "superset-test",
    name: "Superset training",
    date: key(new Date()),
    note: "",
    exercises: ["Squat", "Push-up", "Plank", "Lat Pulldown"].map((name) =>
      exercise(name, 1, 8, "reps", 0),
    ),
  };
  workout.exercises[0].logs[0] = { weight: "95", actual: "8", done: true };
  workout.exercises[0].note = "Good depth.";
  expect(
    (
      await page.request.put("/api/state", {
        headers: { Origin: baseURL },
        data: {
          state: { version: 1, unit: "lbs", programs: [], workouts: [workout] },
          revision: 0,
        },
      })
    ).ok(),
  ).toBeTruthy();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const card = page.locator(".workout-card");
  await card.getByRole("button", { name: "Supersets", exact: false }).click();
  await page
    .getByRole("button", { name: "Create superset", exact: false })
    .click();
  await expect(page.locator(".form-error")).toContainText("at least two");
  await page.getByRole("checkbox", { name: "Squat", exact: true }).check();
  await page.getByRole("checkbox", { name: "Push-up", exact: true }).check();
  await page
    .getByRole("button", { name: "Create superset", exact: false })
    .click();
  await expect(card.locator(".superset-label")).toHaveCount(1);
  await card.getByRole("button", { name: "Supersets", exact: false }).click();
  await expect(page.getByLabel("Superset name", { exact: true })).toHaveValue(
    "B",
  );
  await page.getByRole("checkbox", { name: "Plank", exact: true }).check();
  await page
    .getByRole("checkbox", { name: "Lat Pulldown", exact: true })
    .check();
  await page
    .getByRole("button", { name: "Create superset", exact: false })
    .click();
  await expect(card.locator(".superset-label")).toHaveCount(2);
  await expect(page.locator("#sync-label")).toContainText("Synced");
  await page.reload();
  await card.getByRole("button", { name: "Resume workout" }).click();
  await expect(page.getByRole("button", { name: "Done logging" })).toHaveCount(
    0,
  );
  await expect(page.locator(".log-superset-heading")).toHaveCount(2);
  await expect(
    page.getByLabel("Squat set 1 weight", { exact: true }),
  ).toHaveValue("95");
  await expect(page.getByLabel("Notes for Squat", { exact: true })).toHaveValue(
    "Good depth.",
  );
  await page.getByRole("button", { name: "Collapse workout" }).click();
  await card.getByRole("button", { name: "Supersets", exact: false }).click();
  await page.getByLabel("Choose superset", { exact: true }).selectOption("A");
  await page.getByLabel("Superset name", { exact: true }).fill("Upper");
  await page
    .getByRole("button", { name: "Save superset", exact: false })
    .click();
  await expect(
    card.locator(".superset-label").filter({ hasText: "SUPERSET UPPER" }),
  ).toBeVisible();
  await card.getByRole("button", { name: "Supersets", exact: false }).click();
  await page
    .getByLabel("Choose superset", { exact: true })
    .selectOption("UPPER");
  await page
    .getByRole("button", { name: "Remove superset", exact: true })
    .click();
  await expect(card.locator(".superset-label")).toHaveCount(1);
  const saved = await page.evaluate(() => window.readTestJournal());
  expect(
    saved.workouts[0].exercises.find((e) => e.name === "Squat").logs[0],
  ).toEqual({ weight: "95", actual: "8", done: true });
  expect(saved.workouts[0].exercises.find((e) => e.name === "Squat").note).toBe(
    "Good depth.",
  );
});
