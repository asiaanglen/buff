import { openExercise } from "./exercise-navigation.js";
import { navigateTo } from "./navigation.js";
import { test, expect } from "./auth-fixture.js";
import { exercise } from "../../src/model.js";
test("set checkoff and bulk completion preserve actual results, exclude partial workouts and advance the active program", async ({
  page,
  baseURL,
}) => {
  const program = {
    id: "complete-program",
    name: "Completion program",
    weeks: 4,
    startDate: "2026-10-26",
    note: "",
  };
  const workouts = ["Session one", "Session two"].map((name, i) => ({
    id: "complete-" + i,
    name,
    date: `2026-10-${26 + i}`,
    programId: program.id,
    note: "",
    exercises: [
      exercise("Squat", 2, 8, "reps", 95),
      exercise("Plank", 1, 45, "time", 0),
    ],
  }));
  const state = {
    version: 1,
    unit: "lbs",
    activeProgramId: program.id,
    programs: [program],
    workouts,
  };
  expect(
    (
      await page.request.put("/api/state", {
        headers: { Origin: baseURL },
        data: { state, revision: 0 },
      })
    ).ok(),
  ).toBeTruthy();
  await page.goto("/");
  const next = page.getByRole("region", { name: "Next workout" });
  await next.getByRole("button", { name: "Start workout" }).click();
  await page.getByLabel("Squat set 1 weight", { exact: true }).fill("0");
  await page.getByLabel("Squat set 1 reps", { exact: true }).fill("6");
  await page.getByLabel("Squat set 1 completed", { exact: true }).check();
  await page.getByLabel("Squat set 2 completed", { exact: true }).check();
  await expect(
    page.getByLabel("Squat set 1 completed", { exact: true }),
  ).toBeChecked();
  await expect(
    page.getByLabel("Squat set 2 completed", { exact: true }),
  ).toBeChecked();
  await page.getByRole("button", { name: "Collapse workout" }).click();
  await navigateTo(page, "history");
  await expect(page.locator(".history-card")).toHaveCount(0);
  await navigateTo(page, "home");
  await next.getByRole("button", { name: "Resume workout" }).click();
  await openExercise(page, "Plank");
  await page.getByLabel("Plank set 1 seconds", { exact: true }).fill("");
  await page
    .getByRole("button", { name: "Mark as complete", exact: true })
    .click();
  await expect(page.locator(".inline-workout-log")).toBeVisible();
  expect(
    (await page.evaluate(() => window.readTestJournal())).workouts[0]
      .exercises[1].logs[0].done,
  ).toBe(false);
  await page.getByLabel("Plank set 1 seconds", { exact: true }).fill("40");
  await page
    .getByRole("button", { name: "Mark as complete", exact: true })
    .click();
  await expect(
    next.getByRole("heading", { name: "Session two" }),
  ).toBeVisible();
  await expect(
    page.locator(".home-workout").filter({ hasText: "Session one" }),
  ).toHaveClass(/workout-complete/);
  await expect(page.locator("#sync-label")).toContainText("Synced");
  const saved = await (await page.request.get("/api/state")).json();
  expect(saved.state.workouts[0].exercises[0].logs[0]).toEqual({
    weight: "0",
    actual: "6",
    done: true,
  });
  expect(saved.state.workouts[0].exercises[0].logs[1]).toEqual({
    weight: "95",
    actual: "8",
    done: true,
  });
  expect(saved.state.workouts[0].exercises[1].logs[0]).toEqual({
    weight: "0",
    actual: "40",
    done: true,
  });
  await navigateTo(page, "history");
  await expect(
    page.locator(".history-card").getByRole("heading", { name: "Session one" }),
  ).toBeVisible();
  await expect(page.locator(".history-card")).toHaveCount(1);
  await page.reload();
  await navigateTo(page, "history");
  await page.getByRole("button", { name: "View log" }).click();
  await page.getByLabel("Squat set 1 completed", { exact: true }).uncheck();
  await expect(
    page.getByLabel("Squat set 1 weight", { exact: true }),
  ).toHaveValue("0");
  await page.getByRole("button", { name: "Collapse workout" }).click();
  await expect(page.locator(".history-card")).toHaveCount(0);
});

test("completed program workouts collapse, stay grey after reload, and retain editable logs", async ({
  page,
  baseURL,
}) => {
  const program = {
    id: "compact",
    name: "Compact program",
    weeks: 4,
    startDate: "2026-10-26",
    note: "",
  };
  const workouts = ["Checkoff session", "Bulk session"].map((name, i) => ({
    id: `compact-${i}`,
    name,
    date: "2026-10-26",
    programId: program.id,
    note: "Private workout reminder",
    exercises: [exercise("Back Squat", 1, 5, "reps", 135)],
  }));
  const response = await page.request.put("/api/state", {
    headers: { Origin: baseURL },
    data: {
      revision: 0,
      state: { version: 1, unit: "lbs", programs: [program], workouts },
    },
  });
  expect(response.ok()).toBeTruthy();
  await page.goto("/");
  await navigateTo(page, "programs");
  await page.getByRole("button", { name: /View Program/ }).click();
  const first = page
    .locator(".workout-card")
    .filter({ hasText: "Checkoff session" });
  await first.getByRole("button", { name: "Start workout" }).click();
  await first.getByLabel("Back Squat set 1 completed", { exact: true }).click();
  await expect(first).toHaveClass(/workout-minimized/);
  await expect(
    first.locator(".exercise-preview, .inline-workout-log, .workout-note"),
  ).toHaveCount(0);
  await expect(first).toHaveCSS("background-color", "rgb(238, 239, 241)");
  const second = page
    .locator(".workout-card")
    .filter({ hasText: "Bulk session" });
  await second.getByRole("button", { name: "Start workout" }).click();
  await second
    .getByRole("button", { name: "Mark as complete", exact: true })
    .click();
  await expect(page.locator(".workout-minimized")).toHaveCount(2);
  await expect(page.locator("#sync-label")).toContainText("Synced");
  await page.reload();
  await navigateTo(page, "programs");
  await page.getByRole("button", { name: /View Program/ }).click();
  await expect(page.locator(".workout-minimized")).toHaveCount(2);
  await first.getByRole("button", { name: "View log", exact: true }).click();
  await expect(
    first.getByLabel("Back Squat set 1 weight", { exact: true }),
  ).toHaveValue("135");
  await first
    .getByLabel("Back Squat set 1 completed", { exact: true })
    .uncheck();
  await first.getByRole("button", { name: "Collapse workout" }).click();
  await expect(first).not.toHaveClass(/workout-complete/);
  await expect(first.locator(".exercise-preview")).toBeVisible();
});
