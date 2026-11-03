import { openExercise } from "./exercise-navigation.js";
import { test, expect } from "./auth-fixture.js";
import { initialState } from "../../src/model.js";
test("actual fields start blank, targets are under the name, and completing a set requires entered results", async ({
  page,
}) => {
  const state = initialState();
  await page.addInitScript(
    (data) => localStorage.setItem("buff-v1", JSON.stringify(data)),
    state,
  );
  await page.goto("/app");
  await page.getByRole("button", { name: "Start workout" }).click();
  await expect(
    page.getByLabel("Barbell bench press set 1 weight", { exact: true }),
  ).toHaveValue("");
  await expect(
    page.getByLabel("Barbell bench press set 1 reps", { exact: true }),
  ).toHaveValue("");
  await expect(
    page.getByLabel("Plank set 1 weight", { exact: true }),
  ).toHaveValue("");
  await expect(
    page.getByLabel("Plank set 1 seconds", { exact: true }),
  ).toHaveValue("");
  expect(
    await page.evaluate(
      () => window.readTestJournal().workouts[0].exercises[0].logs[0],
    ),
  ).toEqual({ weight: "", actual: "", done: false });
  await expect(
    page
      .locator(".exercise-accordion")
      .first()
      .locator(".exercise-plan-target"),
  ).toHaveText("Target: 4 sets × 8 reps · 40 lbs");
  await page
    .getByLabel("Barbell bench press set 1 weight", { exact: true })
    .fill("40");
  await page
    .getByLabel("Barbell bench press set 1 reps", { exact: true })
    .fill("8");
  await page
    .getByLabel("Barbell bench press set 1 completed", { exact: true })
    .check();
  await openExercise(page, "Plank");
  await page.getByLabel("Plank set 1 weight", { exact: true }).fill("0");
  await page.getByLabel("Plank set 1 seconds", { exact: true }).fill("45");
  await page.getByLabel("Plank set 1 completed", { exact: true }).check();
  await page.getByRole("button", { name: "Collapse workout" }).click();
  await expect(page.locator(".workout-card")).toContainText("2 sets completed");
  const saved = await page.evaluate(() => window.readTestJournal());
  expect(saved.workouts[0].exercises[0].logs[0]).toEqual({
    weight: "40",
    actual: "8",
    done: true,
  });
  expect(saved.workouts[0].exercises[3].logs[0]).toEqual({
    weight: "0",
    actual: "45",
    done: true,
  });
});
test("existing results and zero values are preserved; clearing a default prevents completion", async ({
  page,
}) => {
  const state = initialState();
  state.workouts[0].exercises[0].logs[0] = {
    weight: "0",
    actual: "0",
    done: true,
  };
  state.workouts[0].exercises[0].logs[1] = {
    weight: "95",
    actual: "6",
    done: false,
  };
  await page.addInitScript(
    (data) => localStorage.setItem("buff-v1", JSON.stringify(data)),
    state,
  );
  await page.goto("/app");
  await page.getByRole("button", { name: "Resume workout" }).click();
  await expect(
    page.getByLabel("Barbell bench press set 1 weight", { exact: true }),
  ).toHaveValue("0");
  await expect(
    page.getByLabel("Barbell bench press set 1 reps", { exact: true }),
  ).toHaveValue("0");
  await expect(
    page.getByLabel("Barbell bench press set 2 weight", { exact: true }),
  ).toHaveValue("95");
  await expect(
    page.getByLabel("Barbell bench press set 2 reps", { exact: true }),
  ).toHaveValue("6");
  await page
    .getByLabel("Barbell bench press set 3 reps", { exact: true })
    .fill("");
  await page
    .getByLabel("Barbell bench press set 3 completed", { exact: true })
    .click();
  await expect(
    page.getByLabel("Barbell bench press set 3 completed", { exact: true }),
  ).not.toBeChecked();
  await expect(page.locator(".log-intro")).toContainText("Enter both weight");
});
