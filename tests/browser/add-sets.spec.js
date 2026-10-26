import { exercise, key } from "../../src/model.js";
import { test, expect } from "./auth-fixture.js";
test("inline exercises have only set checkboxes and additional sets preserve results and notes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.locator('[data-action="expand-exercise"]').first().click();
  await expect(
    page.getByLabel("Barbell bench press exercise completed", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByLabel("Barbell bench press set 1 weight", { exact: true })
    .fill("95");
  await page
    .getByLabel("Barbell bench press set 1 completed", { exact: true })
    .check();
  await page
    .getByLabel("Notes for Barbell bench press", { exact: true })
    .fill("Add a back-off set.");
  await page
    .getByRole("button", {
      name: "Add set to Barbell bench press",
      exact: true,
    })
    .click();
  await expect(
    page.getByLabel("Barbell bench press set 5 weight", { exact: true }),
  ).toHaveValue("40");
  await expect(
    page.getByLabel("Barbell bench press set 5 reps", { exact: true }),
  ).toHaveValue("8");
  await expect(
    page.getByLabel("Barbell bench press set 5 completed", { exact: true }),
  ).not.toBeChecked();
  await expect(
    page.getByLabel("Barbell bench press set 1 weight", { exact: true }),
  ).toHaveValue("95");
  await expect(
    page.getByLabel("Barbell bench press set 1 completed", { exact: true }),
  ).toBeChecked();
  await expect(
    page.getByLabel("Notes for Barbell bench press", { exact: true }),
  ).toHaveValue("Add a back-off set.");
  await page
    .getByLabel("Barbell bench press set 5 reps", { exact: true })
    .fill("6");
  await page
    .getByLabel("Barbell bench press set 5 completed", { exact: true })
    .check();
  await expect(page.locator("#sync-label")).toContainText("Synced");
  await page.reload();
  await page.locator('[data-action="expand-exercise"]').first().click();
  await expect(
    page.getByLabel("Barbell bench press set 5 reps", { exact: true }),
  ).toHaveValue("6");
  await expect(
    page.getByLabel("Barbell bench press set 5 completed", { exact: true }),
  ).toBeChecked();
});

test("completing one expanded workout never completes another expanded workout", async ({
  page,
  baseURL,
}) => {
  const workouts = ["First workout", "Second workout"].map((name, i) => ({
    id: "multi-" + i,
    name,
    date: key(new Date()),
    note: "",
    exercises: [exercise(i ? "Row" : "Squat", 1, 8, "reps", i ? 35 : 95)],
  }));
  expect(
    (
      await page.request.put("/api/state", {
        headers: { Origin: baseURL },
        data: {
          state: { version: 1, unit: "lbs", programs: [], workouts },
          revision: 0,
        },
      })
    ).ok(),
  ).toBeTruthy();
  await page.goto("/");
  const first = page
    .locator(".workout-card")
    .filter({
      has: page.getByRole("heading", { name: "First workout", exact: true }),
    });
  const second = page
    .locator(".workout-card")
    .filter({
      has: page.getByRole("heading", { name: "Second workout", exact: true }),
    });
  await first.getByRole("button", { name: "Log workout" }).click();
  await second.getByRole("button", { name: "Log workout" }).click();
  await page.getByLabel("Row set 1 weight", { exact: true }).fill("40");
  await first
    .getByRole("button", { name: "Mark as complete", exact: true })
    .click();
  await expect(page.locator("#sync-label")).toContainText("Synced");
  const saved = await (await page.request.get("/api/state")).json();
  expect(saved.state.workouts[0].exercises[0].logs[0].done).toBe(true);
  expect(saved.state.workouts[1].exercises[0].logs[0].done).toBe(false);
  expect(saved.state.workouts[1].exercises[0].logs[0].weight).toBe("40");
  await expect(page.locator(".history-card")).toHaveCount(1);
});
