import { test, expect } from "./auth-fixture.js";
import { exercise, addDays } from "../../src/model.js";
import { navigateTo } from "./navigation.js";

test("programs run in order without a calendar; skipping, undoing, finishing and switching preserve history across devices", async ({
  page,
  browser,
  baseURL,
}) => {
  const p = {
    id: "sequence",
    name: "My next program",
    startDate: "2030-01-01",
    weeks: 2,
    note: "",
  };
  const other = { ...p, id: "other", name: "Another program" };
  const workouts = [0, 1, 2].map((i) => ({
    id: "session" + i,
    name: "Session " + (i + 1),
    programId: p.id,
    date: addDays(p.startDate, i),
    note: "",
    exercises: [exercise("Back Squat", 2, 8)],
  }));
  workouts[0].exercises[0].logs[0] = { weight: 95, actual: 8, done: true };
  workouts.push({
    ...structuredClone(workouts[1]),
    id: "other-session",
    name: "Other session",
    programId: other.id,
  });
  expect(
    (
      await page.request.put("/api/state", {
        headers: { Origin: baseURL },
        data: {
          revision: 0,
          state: { version: 1, unit: "lbs", programs: [p, other], workouts },
        },
      })
    ).ok(),
  ).toBeTruthy();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("combobox", { name: "Go to page" }).locator("option"),
  ).toHaveText(["Home", "Programs", "Completed workouts"]);
  await expect(
    page.locator('[data-tab="planner"], .calendar-grid, .days'),
  ).toHaveCount(0);
  await navigateTo(page, "programs");
  await page
    .locator(".program-card")
    .filter({ hasText: p.name })
    .getByRole("button", { name: "Start program", exact: false })
    .click();
  const next = page.getByRole("region", { name: "Next workout", exact: true });
  await expect(
    next.getByRole("heading", { name: "Session 1", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  page.once("dialog", (d) => d.accept());
  await next.getByRole("button", { name: "Skip workout", exact: true }).click();
  await expect(
    next.getByRole("heading", { name: "Session 2", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".home-workout").filter({ hasText: "Session 1" }),
  ).toContainText("Skipped");
  await page.reload();
  await expect(next).toContainText("Session 2");
  await page
    .locator(".home-workout")
    .filter({ hasText: "Session 1" })
    .getByRole("button", { name: "Undo skip", exact: true })
    .click();
  await expect(next).toContainText("Session 1");
  await next
    .getByRole("button", { name: "Resume workout", exact: false })
    .click();
  await expect(
    page.getByLabel("Back Squat set 1 reps", { exact: true }),
  ).toHaveValue("8");
  await page
    .getByRole("button", { name: "Mark as complete", exact: true })
    .click();
  await expect(next).toContainText("Session 2");
  for (const name of ["Session 2", "Session 3"]) {
    page.once("dialog", (d) => d.accept());
    await next
      .getByRole("button", { name: "Skip workout", exact: true })
      .click();
  }
  await expect(next).toContainText("You’ve reached the end");
  await expect(next).toContainText("1 completed · 2 skipped");
  await expect(page.locator("#sync-label")).toContainText("Synced");
  const remote = await (await page.request.get("/api/state")).json();
  expect(remote.state.workouts[0].exercises[0].logs[0]).toEqual({
    weight: "95",
    actual: "8",
    done: true,
  });
  expect(remote.state.workouts[0].completed).toBe(true);
  expect(remote.state.workouts[1].skipped).toBe(true);
  await navigateTo(page, "history");
  await expect(page.locator(".history-card")).toHaveCount(1);
  await expect(page.locator(".history-card")).toContainText("Session 1");
  await navigateTo(page, "programs");
  page.once("dialog", (d) => d.accept());
  await page
    .locator(".program-card")
    .filter({ hasText: other.name })
    .getByRole("button", { name: "Start program", exact: false })
    .click();
  await expect(next).toContainText("Other session");
  const device = await browser.newContext({
    baseURL,
    storageState: { cookies: await page.context().cookies(), origins: [] },
  });
  const screen = await device.newPage();
  await screen.goto("/");
  await expect(
    screen.getByRole("region", { name: "Next workout" }),
  ).toContainText("Other session");
  await expect(screen.locator('[data-tab="planner"]')).toHaveCount(0);
  await device.close();
});

test("manual program creation uses numbered weeks instead of calendar inputs", async ({
  page,
}) => {
  await page.goto("/?tab=programs");
  await page
    .getByRole("button", { name: "Create program", exact: false })
    .first()
    .click();
  await page.getByLabel("Program name", { exact: true }).fill("At my pace");
  await page.getByLabel("Number of weeks").fill("4");
  await expect(page.locator('input[type="date"]')).toHaveCount(0);
  await page
    .locator("#program-form")
    .getByRole("button", { name: "Create program", exact: false })
    .click();
  await expect(
    page.getByRole("heading", { name: "Week 1", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Align with planner" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Add workout", exact: false })
    .first()
    .click();
  await expect(page.locator('input[type="date"]')).toHaveCount(0);
  await page
    .getByLabel("Search exercise library", { exact: true })
    .fill("Back Squat");
  await page
    .locator('[data-action="choose-exercise"]')
    .filter({ hasText: "Back Squat" })
    .first()
    .click();
  await page
    .locator("#workout-form")
    .getByRole("button", { name: "Create workout", exact: false })
    .click();
  await expect(page.locator(".program-detail")).toContainText("Workout 1");
  await page
    .getByRole("button", { name: "Start program", exact: false })
    .first()
    .click();
  await expect(
    page.getByRole("region", { name: "Next workout" }),
  ).toContainText("Back Squat");
});
