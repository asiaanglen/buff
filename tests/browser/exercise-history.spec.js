import { test, expect } from "@playwright/test";
import { exercise, initialState, addDays, key } from "../../src/model.js";
test("logger shows previous actual weights and reps per set without marking prefilled targets completed", async ({
  page,
}) => {
  const state = initialState(),
    current = state.workouts[0];
  const past = structuredClone(current);
  past.id = "past";
  past.name = "Previous session";
  past.date = addDays(current.date, -7);
  past.exercises[0].logs[0] = { weight: "42.5", actual: "9", done: true };
  past.exercises[0].logs[1] = { weight: "40", actual: "8", done: true };
  past.exercises[3].logs[0] = { weight: "0", actual: "50", done: true };
  state.workouts.unshift(past);
  await page.addInitScript(
    (data) => localStorage.setItem("buff-v1", JSON.stringify(data)),
    state,
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Log workout" }).click();
  const bench = page.locator(".log-exercise").filter({
    has: page.getByRole("heading", {
      name: "Barbell bench press",
      exact: true,
    }),
  });
  await expect(bench.locator(".previous-performance")).toContainText(
    "40 lbs × 8 reps",
  );
  await expect(bench.locator(".log-row").first()).toContainText(
    "Last: 42.5 lbs",
  );
  await expect(bench.locator(".log-row").first()).toContainText("Last: 9 reps");
  await expect(
    page.getByLabel("Barbell bench press set 1 weight", { exact: true }),
  ).toHaveValue("40");
  const plank = page
    .locator(".log-exercise")
    .filter({ has: page.getByRole("heading", { name: "Plank", exact: true }) });
  await expect(plank.locator(".previous-performance")).toContainText(
    "0 lbs × 50 sec",
  );
  await page
    .getByLabel("Barbell bench press set 1 weight", { exact: true })
    .fill("45");
  await page
    .getByLabel("Barbell bench press set 1 reps", { exact: true })
    .fill("8");
  await page
    .getByLabel("Barbell bench press set 1 completed", { exact: true })
    .check();
  await expect(bench.locator(".previous-performance")).toContainText(
    "40 lbs × 8 reps",
  );
});

test("existing device history is displayed in pounds after conversion without changing recorded reps", async ({
  page,
}) => {
  const state = initialState();
  state.unit = "kg";
  const current = state.workouts[0];
  const past = structuredClone(current);
  past.id = "legacy-past";
  past.name = "Legacy workout";
  past.date = addDays(current.date, -7);
  past.exercises[0].logs[0] = { weight: "40", actual: "8", done: true };
  state.workouts.unshift(past);
  await page.addInitScript(
    (data) => localStorage.setItem("buff-v1", JSON.stringify(data)),
    state,
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Log workout" }).click();
  const bench = page.locator(".log-exercise").filter({
    has: page.getByRole("heading", {
      name: "Barbell bench press",
      exact: true,
    }),
  });
  await expect(bench.locator(".previous-performance")).toContainText(
    "88.18 lbs × 8 reps",
  );
  await expect(bench).toContainText("WEIGHT (lbs)");
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("buff-v1")),
  );
  expect(saved.unit).toBe("lbs");
  expect(saved.workouts[0].exercises[0].logs[0].actual).toBe("8");
});
