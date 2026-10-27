import { test, expect } from "./auth-fixture.js";
import { exercise } from "../../src/model.js";
import { navigateTo } from "./navigation.js";
test.use({ timezoneId: "America/Los_Angeles" });
test("starting and realigning a program places the same workouts on the weekly planner and syncs the dates", async ({
  page,
  baseURL,
  browser,
}) => {
  const program = {
    id: "align-program",
    name: "Aligned strength",
    weeks: 4,
    startDate: "2026-01-05",
    note: "",
  };
  const workouts = ["2026-01-05", "2026-01-07", "2026-01-12"].map(
    (date, i) => ({
      id: "align-workout-" + i,
      programId: program.id,
      name: ["Lower day", "Upper day", "Week two lower"][i],
      date,
      note: "Keep this plan",
      exercises: [exercise("Back Squat", 2, 5, "reps", 95)],
    }),
  );
  const unrelated = {
    id: "separate-workout",
    name: "Separate workout",
    date: "2026-01-06",
    note: "",
    exercises: [],
  };
  expect(
    (
      await page.request.put("/api/state", {
        headers: { Origin: baseURL },
        data: {
          state: {
            version: 1,
            unit: "lbs",
            programs: [program],
            workouts: [...workouts, unrelated],
          },
          revision: 0,
        },
      })
    ).ok(),
  ).toBeTruthy();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await navigateTo(page, "programs");
  await page
    .getByRole("button", { name: "Start program →", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Start your program" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  expect(
    (await (await page.request.get("/api/state")).json()).state.activeProgramId,
  ).toBeUndefined();
  await page
    .getByRole("button", { name: "Start program →", exact: true })
    .click();
  await page.getByRole("button", { name: "Next Monday", exact: true }).click();
  expect(
    new Date(
      (await page
        .getByLabel("Week 1 start date", { exact: true })
        .inputValue()) + "T12:00:00",
    ).getDay(),
  ).toBe(1);
  await page
    .getByLabel("Week 1 start date", { exact: true })
    .fill("2026-11-02");
  await expect(page.locator(".program-alignment-preview")).toContainText(
    "Wed, Nov 4, 2026",
  );
  await page
    .getByRole("button", { name: "Start program & align →", exact: true })
    .click();
  await expect(
    page
      .getByRole("region", { name: "Next workout" })
      .getByRole("heading", { name: "Lower day" }),
  ).toBeVisible();
  await expect(page.locator("#sync-label")).toContainText("Synced");
  const saved = await (await page.request.get("/api/state")).json();
  expect(saved.state.activeProgramId).toBe(program.id);
  expect(saved.state.programs[0].startDate).toBe("2026-11-02");
  expect(saved.state.workouts.slice(0, 3).map((w) => w.date)).toEqual([
    "2026-11-02",
    "2026-11-04",
    "2026-11-09",
  ]);
  expect(saved.state.workouts[0].exercises).toEqual(workouts[0].exercises);
  expect(saved.state.workouts[3].date).toBe("2026-01-06");
  await page
    .getByRole("button", { name: "View in Weekly planner", exact: false })
    .click();
  await expect(page.locator('[data-day="2026-11-02"]')).toContainText(
    "Lower day",
  );
  await expect(page.locator('[data-day="2026-11-04"]')).toContainText(
    "Upper day",
  );
  await expect(
    page
      .locator(".workout-card")
      .getByRole("heading", { name: "Lower day", exact: true }),
  ).toBeVisible();
  await navigateTo(page, "home");
  await page
    .getByRole("button", { name: "Align with planner", exact: true })
    .click();
  await page
    .getByLabel("Week 1 start date", { exact: true })
    .fill("2026-11-09");
  await page
    .getByRole("button", { name: "Save alignment →", exact: true })
    .click();
  await expect(page.locator('[data-day="2026-11-09"]')).toContainText(
    "Lower day",
  );
  await expect(page.locator("#sync-label")).toContainText("Synced");
  const other = await browser.newContext({
    storageState: { cookies: await page.context().cookies(), origins: [] },
  });
  const device = await other.newPage();
  await device.goto(baseURL);
  await device
    .getByRole("button", { name: "View in Weekly planner", exact: false })
    .click();
  await expect(device.locator('[data-day="2026-11-09"]')).toContainText(
    "Lower day",
  );
  await other.close();
});
test("a logged program can move from November 4 to Today on iPhone without losing history", async ({
  page,
  baseURL,
  browser,
}) => {
  await page.clock.setFixedTime(new Date("2026-10-27T02:28:00Z"));
  await page.setViewportSize({ width: 390, height: 844 });
  const program = {
    id: "recorded-program",
    name: "Recorded strength",
    weeks: 4,
    startDate: "2026-11-04",
    note: "Keep this program",
  };
  const workouts = ["2026-11-04", "2026-11-06", "2026-11-11"].map(
    (date, index) => ({
      id: "recorded-workout-" + index,
      programId: program.id,
      name: ["Completed lower", "Partial upper", "Next week lower"][index],
      date,
      note: "Keep this workout note",
      exercises: [exercise("Back Squat", 2, 5, "reps", 95)],
    }),
  );
  workouts[0].exercises[0].logs = [
    { weight: "95", actual: "5", done: true },
    { weight: "100", actual: "4", done: true },
  ];
  workouts[0].exercises[0].note = "Keep this session note";
  workouts[1].exercises[0].logs[0] = { weight: "95", actual: "3", done: false };
  const other = {
    id: "unrelated",
    name: "Separate workout",
    date: "2026-11-04",
    note: "",
    exercises: [],
  };
  expect(
    (
      await page.request.put("/api/state", {
        headers: { Origin: baseURL },
        data: {
          state: {
            version: 1,
            unit: "lbs",
            activeProgramId: program.id,
            programs: [program],
            workouts: [...workouts, other],
          },
          revision: 0,
        },
      })
    ).ok(),
  ).toBeTruthy();
  await page.goto("/");
  await page
    .getByRole("button", { name: "Align with planner", exact: true })
    .click();
  await expect(
    page.getByLabel("Week 1 start date", { exact: true }),
  ).toHaveJSProperty("readOnly", false);
  await expect(page.getByRole("dialog")).toContainText(
    "Your logged sets, weights, and notes are kept.",
  );
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(
    page.getByLabel("Week 1 start date", { exact: true }),
  ).toHaveValue("2026-10-26");
  await expect(page.locator(".program-alignment-preview")).toContainText(
    "Wed, Oct 28, 2026",
  );
  await page
    .getByRole("button", { name: "Save alignment →", exact: true })
    .click();
  await expect(page.locator(".workout-minimized")).toContainText(
    "Completed lower",
  );
  await expect(page.locator("#sync-label")).toContainText("Synced");
  const { state } = await (await page.request.get("/api/state")).json();
  expect(state.programs[0].startDate).toBe("2026-10-26");
  expect(state.workouts.map((w) => w.date)).toEqual([
    "2026-10-26",
    "2026-10-28",
    "2026-11-02",
    "2026-11-04",
  ]);
  expect(state.workouts.map((w) => w.id)).toEqual(
    [...workouts, other].map((w) => w.id),
  );
  for (let index = 0; index < workouts.length; index++) {
    expect(state.workouts[index].exercises).toEqual(workouts[index].exercises);
    expect(state.workouts[index].note).toBe(workouts[index].note);
  }
  expect(state.workouts[3]).toEqual(other);
  await page.getByRole("button", { name: "View log", exact: true }).click();
  await expect(
    page.getByLabel("Back Squat set 2 weight", { exact: true }),
  ).toHaveValue("100");
  await expect(
    page.getByLabel("Back Squat set 2 reps", { exact: true }),
  ).toHaveValue("4");
  await expect(
    page.getByLabel("Notes for Back Squat", { exact: true }),
  ).toHaveValue("Keep this session note");
  const context = await browser.newContext({
    storageState: { cookies: await page.context().cookies(), origins: [] },
    timezoneId: "America/Los_Angeles",
  });
  const device = await context.newPage();
  await device.goto(baseURL);
  await device
    .getByRole("button", { name: "Align with planner", exact: true })
    .click();
  await expect(
    device.getByLabel("Week 1 start date", { exact: true }),
  ).toHaveValue("2026-10-26");
  await context.close();
});
