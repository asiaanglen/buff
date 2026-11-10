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

test("Completed workouts can undo accidental completion without deleting plans, sets or notes", async ({
  page,
  browser,
  baseURL,
}) => {
  const program = {
    id: "undo",
    name: "Undo completion program",
    startDate: "2030-01-01",
    weeks: 2,
    note: "",
  };
  const names = [
    "Fully logged",
    "Partially logged",
    "No sets logged",
    "Standalone workout",
  ];
  const workouts = names.map((name, i) => ({
    id: "undo" + i,
    name,
    date: addDays(program.startDate, i),
    note: "Keep workout notes",
    ...(i < 3 ? { programId: program.id } : {}),
    exercises: [exercise("Back Squat", 2, 8)],
    ...(i ? { completed: true } : {}),
  }));
  workouts[0].exercises[0].logs = [
    { weight: 95, actual: 8, done: true },
    { weight: 95, actual: 6, done: true },
  ];
  workouts[1].exercises[0].logs[0] = { weight: 85, actual: 5, done: true };
  workouts[0].exercises[0].note = "Keep exercise notes";
  expect(
    (
      await page.request.put("/api/state", {
        headers: { Origin: baseURL },
        data: {
          revision: 0,
          state: {
            version: 1,
            unit: "lbs",
            activeProgramId: program.id,
            programs: [program],
            workouts,
          },
        },
      })
    ).ok(),
  ).toBeTruthy();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await navigateTo(page, "history");
  await expect(page.locator(".history-card")).toHaveCount(4);
  const remove = (name) =>
    page.getByRole("button", {
      name: `Remove ${name} from completed workouts`,
      exact: true,
    });
  page.once("dialog", (d) => d.dismiss());
  await remove(names[0]).click();
  await expect(page.locator(".history-card")).toHaveCount(4);
  page.once("dialog", (d) => {
    expect(d.message()).toContain("logged sets");
    return d.accept();
  });
  await remove(names[0]).click();
  await expect(page.locator(".history-card")).toHaveCount(3);
  await navigateTo(page, "home");
  const next = page.getByRole("region", { name: "Next workout" });
  await expect(next).toContainText(names[0]);
  await next
    .getByRole("button", { name: "Resume workout", exact: false })
    .click();
  await expect(
    page.getByLabel("Back Squat set 1 reps", { exact: true }),
  ).toHaveValue("8");
  await expect(
    page.getByLabel("Back Squat set 1 completed", { exact: true }),
  ).toBeChecked();
  await page
    .getByRole("button", { name: "Mark as complete", exact: true })
    .click();
  await navigateTo(page, "history");
  await expect(page.locator(".history-card")).toHaveCount(4);
  for (const name of names) {
    page.once("dialog", (d) => d.accept());
    await remove(name).click();
  }
  await expect(page.locator(".history-card")).toHaveCount(0);
  await expect(page.locator("#sync-label")).toContainText("Synced");
  const saved = (await (await page.request.get("/api/state")).json()).state;
  expect(saved.workouts).toHaveLength(4);
  expect(saved.activeProgramId).toBe(program.id);
  for (let i = 0; i < workouts.length; i++) {
    expect(saved.workouts[i].completionUndone).toBe(true);
    expect(saved.workouts[i].programId).toBe(workouts[i].programId);
    expect(saved.workouts[i].note).toBe(workouts[i].note);
  }
  expect(saved.workouts[1].exercises).toEqual(workouts[1].exercises);
  expect(saved.workouts[0].exercises[0].note).toBe("Keep exercise notes");
  expect(Number(saved.workouts[0].exercises[0].logs[0].weight)).toBe(95);
  await page.reload();
  await navigateTo(page, "history");
  await expect(page.locator(".history-card")).toHaveCount(0);
  const other = await browser.newContext({
    baseURL,
    storageState: { cookies: await page.context().cookies(), origins: [] },
  });
  try {
    const screen = await other.newPage();
    await screen.goto("/");
    await expect(
      screen.getByRole("region", { name: "Next workout" }),
    ).toContainText(names[0]);
    await navigateTo(screen, "history");
    await expect(screen.locator(".history-card")).toHaveCount(0);
  } finally {
    await other.close();
  }
});
