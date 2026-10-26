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
  await next.getByRole("button", { name: "Log workout" }).click();
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
  await next.getByRole("button", { name: "Continue logging" }).click();
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
