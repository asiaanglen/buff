import { test, expect } from "./auth-fixture.js";
import { exercise } from "../../src/model.js";
import { navigateTo } from "./navigation.js";
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
test("programs with recorded results keep their actual workout dates when opened in the planner", async ({
  page,
  baseURL,
}) => {
  const program = {
    id: "recorded-program",
    name: "Recorded strength",
    weeks: 4,
    startDate: "2026-01-05",
    note: "",
  };
  const entry = exercise("Back Squat", 2, 5, "reps", 95);
  entry.logs[0] = { weight: "95", actual: "5", done: true };
  const workout = {
    id: "recorded-workout",
    programId: program.id,
    name: "Recorded lower",
    date: program.startDate,
    note: "",
    exercises: [entry],
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
            workouts: [workout],
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
  ).toHaveJSProperty("readOnly", true);
  await expect(page.getByRole("dialog")).toContainText("preserve your history");
  await page
    .getByRole("button", { name: "Save alignment →", exact: true })
    .click();
  await expect(page.locator('[data-day="2026-01-05"]')).toContainText(
    "Recorded lower",
  );
  await expect(page.locator("#sync-label")).toContainText("Synced");
  const saved = await (await page.request.get("/api/state")).json();
  expect(saved.state.workouts[0].date).toBe("2026-01-05");
  expect(saved.state.workouts[0].exercises[0].logs[0]).toEqual({
    weight: "95",
    actual: "5",
    done: true,
  });
});
