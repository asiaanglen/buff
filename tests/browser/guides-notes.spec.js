import { workoutTool } from "./exercise-navigation.js";
import { test, expect } from "./auth-fixture.js";
import { exercise, addDays, key } from "../../src/model.js";
test("guides open from the library, plan and workout log without losing edits; notes sync and appear in history", async ({
  page,
  baseURL,
  browser,
}) => {
  const date = key(new Date());
  const past = {
    id: "past-notes",
    name: "Last training day",
    date: addDays(date, -7),
    note: "",
    exercises: [
      exercise("Back Squat", 1, 8, "reps", 95),
      exercise("Plank", 1, 45, "time"),
    ],
  };
  past.exercises[0].logs[0] = { weight: "100", actual: "7", done: true };
  past.exercises[0].note = "Keep elbows under the bar.";
  past.exercises[1].logs[0] = { weight: "0", actual: "50", done: true };
  past.exercises[1].note = "Steady breathing.";
  const current = {
    id: "current-notes",
    name: "Today training",
    date,
    note: "",
    exercises: [exercise("Back Squat", 1, 8, "reps", 95)],
  };
  const future = {
    id: "future-notes",
    name: "Next training",
    date: addDays(date, 7),
    note: "",
    exercises: [exercise("Back Squat", 1, 8, "reps", 95)],
  };
  expect(
    (
      await page.request.put("/api/state", {
        headers: { Origin: baseURL },
        data: {
          state: {
            version: 1,
            unit: "lbs",
            programs: [],
            workouts: [past, current, future],
          },
          revision: 0,
        },
      })
    ).ok(),
  ).toBeTruthy();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const card = page
    .locator(".workout-card")
    .filter({ hasText: "Today training" });
  await card
    .getByRole("button", { name: "Start workout", exact: false })
    .click();
  await card
    .getByRole("button", { name: "How to: Back Squat", exact: true })
    .click();
  await expect(page.locator("#exercise-guide")).toContainText(
    "Set a bar on your upper back",
  );
  await page.keyboard.press("Escape");
  await card
    .getByRole("button", { name: "Collapse workout", exact: false })
    .click();
  await workoutTool(page, card, "Add exercise");
  await page.getByLabel("Exercise name", { exact: true }).fill("plank");
  await page
    .getByRole("button", { name: "How to: Plank", exact: true })
    .click();
  await expect(page.locator("#exercise-guide")).toContainText(
    "Place forearms on the floor",
  );
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("heading", { name: "Add an exercise" }),
  ).toBeVisible();
  await expect(page.getByLabel("Exercise name", { exact: true })).toHaveValue(
    "plank",
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
  await card.getByRole("button", { name: "Start workout" }).click();
  await page.locator(".workout-history summary").click();
  await expect(page.locator(".workout-history")).toContainText(
    "100 lbs × 7 reps",
  );
  await expect(page.locator(".workout-history")).toContainText(
    "Keep elbows under the bar.",
  );
  await page.getByLabel("Back Squat set 1 weight", { exact: true }).fill("105");
  await page
    .getByLabel("Notes for Back Squat", { exact: true })
    .fill("Strong today.\nUse the same stance next time.");
  await page
    .locator(".inline-workout-log")
    .getByRole("button", { name: "How to: Back Squat", exact: true })
    .click();
  await expect(page.locator("#exercise-guide")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByLabel("Back Squat set 1 weight", { exact: true }),
  ).toHaveValue("105");
  await expect(
    page.getByLabel("Notes for Back Squat", { exact: true }),
  ).toHaveValue("Strong today.\nUse the same stance next time.");
  await page
    .getByRole("button", { name: "Mark as complete", exact: true })
    .click();
  await expect(page.locator("#sync-label")).toContainText("Synced");
  const saved = await (await page.request.get("/api/state")).json();
  expect(saved.state.workouts[1].exercises[0].note).toBe(
    "Strong today.\nUse the same stance next time.",
  );
  const other = await browser.newContext({
    storageState: { cookies: await page.context().cookies(), origins: [] },
  });
  const next = await other.newPage();
  await next.goto(baseURL);
  await next.getByRole("button", { name: "Next week", exact: true }).click();
  await next.locator(`[data-day="${future.date}"]`).click();
  await next.getByRole("button", { name: "Start workout" }).click();
  await next.locator(".workout-history summary").click();
  await expect(next.locator(".workout-history")).toContainText(
    "105 lbs × 8 reps",
  );
  await expect(next.locator(".workout-history")).toContainText(
    "Use the same stance next time.",
  );
  await other.close();
});
