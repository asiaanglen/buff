import { test, expect } from "./auth-fixture.js";
import { exercise, key, addDays } from "../../src/model.js";
test("mobile workout reference layout shows instructions, notes and previous results in readable columns", async ({
  page,
  baseURL,
}) => {
  const date = key(new Date());
  const previous = {
    id: "layout-past",
    name: "Last lower body day",
    date: addDays(date, -7),
    note: "",
    exercises: [exercise("Back Squat", 4, 5, "reps", 135)],
  };
  previous.exercises[0].logs = previous.exercises[0].logs.map(() => ({
    weight: "135",
    actual: "5",
    done: true,
  }));
  const current = {
    id: "layout-now",
    name: "Lower body strength",
    date,
    note: "",
    exercises: [exercise("Back Squat", 4, 5, "reps", 135)],
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
            workouts: [previous, current],
          },
          revision: 0,
        },
      })
    ).ok(),
  ).toBeTruthy();
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await page
      .getByRole("button", { name: "Start workout", exact: false })
      .click();
    const panel = page.locator(".exercise-accordion[open]");
    await expect(panel.locator(".exercise-target-display")).toHaveText(
      "5 reps",
    );
    await expect(
      panel.getByRole("list", { name: "Back Squat instructions", exact: true }),
    ).toBeVisible();
    await expect(panel.locator(".log-previous").first()).toContainText(
      "135 lbs × 5",
    );
    const note = await panel
      .getByLabel("Notes for Back Squat", { exact: true })
      .boundingBox();
    const table = await panel.locator(".log-head").boundingBox();
    expect(note.y + note.height).toBeLessThanOrEqual(table.y);
    const row = panel.locator(".log-row").first();
    const columns = await row.evaluate((e) =>
      [...e.children].map((c) => ({
        left: c.getBoundingClientRect().left,
        right: c.getBoundingClientRect().right,
      })),
    );
    expect(columns).toHaveLength(5);
    for (let i = 1; i < columns.length; i++)
      expect(columns[i].left).toBeGreaterThan(columns[i - 1].left);
    expect(columns.at(-1).right).toBeLessThanOrEqual(width);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await panel.screenshot({
      path: `/tmp/buff-reference-exercise-${width}.png`,
    });
  }
  await page.getByLabel("Back Squat set 1 completed", { exact: true }).check();
  await expect(
    page.getByLabel("Back Squat set 1 completed", { exact: true }),
  ).toBeChecked();
});

test("narrow Home and completed workout cards keep the set table inside the phone width", async ({
  page,
  baseURL,
}) => {
  const date = key(new Date());
  const program = {
    id: "layout-program",
    name: "Strength block",
    startDate: date,
    weeks: 4,
    note: "",
  };
  const workout = {
    id: "layout-home",
    programId: program.id,
    name: "Lower strength",
    date,
    note: "",
    exercises: [exercise("Back Squat", 4, 5, "reps", 135)],
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
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Start workout", exact: false })
    .click();
  const check = page.getByLabel("Back Squat set 1 completed", { exact: true });
  const box = await check.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Mark as complete", exact: true })
    .click();
  await page.getByRole("button", { name: "View log", exact: false }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("combobox", { name: "Go to page", exact: true })
    .selectOption("history");
  await page.getByRole("button", { name: "View log", exact: false }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("before Start workout the light preview contains only exercise names and targets", async ({
  page,
}) => {
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    const card = page.locator(".workout-card").first();
    const preview = card.locator(".exercise-preview");
    await expect(preview).toBeVisible();
    await expect(
      preview.getByText("Barbell bench press", { exact: true }),
    ).toBeVisible();
    await expect(preview.getByRole("button")).toHaveCount(0);
    await expect(preview.locator("input,textarea")).toHaveCount(0);
    await expect(
      card.locator(".inline-workout-log,.workout-bottom"),
    ).toHaveCount(0);
    await expect(page.getByText("Log sets", { exact: true })).toHaveCount(0);
    await card
      .getByRole("button", { name: "Start workout", exact: false })
      .click();
    await expect(card.locator(".inline-workout-log")).toBeVisible();
    await expect(
      page.getByLabel("Barbell bench press set 1 weight", { exact: true }),
    ).toBeVisible();
    expect(
      await card.evaluate((e) => getComputedStyle(e).backgroundColor),
    ).toBe("rgb(255, 255, 255)");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await card
      .locator(".exercise-accordion[open]")
      .screenshot({ path: `/tmp/buff-light-workout-${width}.png` });
  }
});
