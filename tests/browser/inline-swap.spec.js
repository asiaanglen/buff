import { editPlannedExercise } from "./exercise-navigation.js";
import { exercise, key } from "../../src/model.js";
import { test, expect } from "./auth-fixture.js";
test.use({ hasTouch: true });
test("exercise dropdown logs in place and opens the library only for swapping, retaining instructions", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const card = page.locator(".workout-card").first();
  await card
    .getByRole("button", { name: "Start workout", exact: false })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const accordion = page.locator(".exercise-accordion").filter({
    has: page.getByRole("heading", {
      name: "Barbell bench press",
      exact: true,
    }),
  });
  await expect(accordion).toHaveAttribute("open", "");
  await expect(
    page.getByLabel("Barbell bench press set 1 weight", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".exercise-library")).toHaveCount(0);
  await expect(
    accordion.getByRole("list", {
      name: "Barbell bench press instructions",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    accordion.getByRole("button", {
      name: "How to: Barbell Bench Press",
      exact: true,
    }),
  ).toHaveCount(0);
  // Leaving an actual-results field fires change before the swap click on phones.
  await page
    .getByLabel("Barbell bench press set 1 weight", { exact: true })
    .fill("45");
  await page
    .getByLabel("Barbell bench press set 1 reps", { exact: true })
    .fill("6");
  await accordion
    .getByRole("button", {
      name: "Swap exercise: Barbell bench press",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "Swap exercise", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Exercise name", { exact: true })
    .fill("incline dumbbell bench");
  await page
    .getByRole("button", {
      name: "Incline Dumbbell Bench Press Chest · Dumbbells · Reps",
      exact: true,
    })
    .click();
  await expect(page.getByLabel("Sets", { exact: true })).toHaveValue("4");
  await expect(page.getByLabel("Target per set", { exact: true })).toHaveValue(
    "8",
  );
  page.once("dialog", (dialog) => {
    expect(dialog.message()).toContain("Uncompleted set entries");
    dialog.accept();
  });
  await page
    .getByRole("button", { name: "Swap exercise →", exact: true })
    .click();
  await expect(
    card.getByRole("heading", {
      name: "Incline Dumbbell Bench Press",
      exact: true,
    }),
  ).toBeVisible();
  await expect
    .poll(async () => {
      const savedState = await (await page.request.get("/api/state")).json();
      const swapped = savedState.state.workouts
        .flatMap((w) => w.exercises)
        .find((e) => e.name === "Incline Dumbbell Bench Press");
      return (
        swapped?.logs.every(
          (l) => l.weight === "" && l.actual === "" && !l.done,
        ) || false
      );
    })
    .toBe(true);
  const replacement = page.locator(".exercise-accordion").filter({
    has: page.getByRole("heading", {
      name: "Incline Dumbbell Bench Press",
      exact: true,
    }),
  });
  await replacement.locator("summary").click();
  await expect(
    page.getByLabel("Incline Dumbbell Bench Press set 1 weight", {
      exact: true,
    }),
  ).toBeHidden();
  await replacement.locator("summary").click();
  await page
    .getByLabel("Incline Dumbbell Bench Press set 1 weight", { exact: true })
    .fill("35");
  await page
    .getByLabel("Incline Dumbbell Bench Press set 1 completed", { exact: true })
    .check();
  // Touch users can open the library even with completed sets; history is retained.
  await replacement
    .getByRole("button", {
      name: "Swap exercise: Incline Dumbbell Bench Press",
      exact: true,
    })
    .tap();
  await expect(page.locator(".exercise-swap-message")).toContainText(
    "original exercise and results will be kept",
  );
  await page.getByLabel("Exercise name", { exact: true }).fill("front squat");
  await page
    .getByRole("button", {
      name: "Front Squat Legs · Barbell · Reps",
      exact: true,
    })
    .tap();
  await page
    .getByRole("button", { name: "Add replacement →", exact: true })
    .tap();
  await expect
    .poll(async () => {
      const saved = await (await page.request.get("/api/state")).json();
      const entries = saved.state.workouts.flatMap((w) => w.exercises);
      const original = entries.find(
        (e) => e.name === "Incline Dumbbell Bench Press",
      );
      const added = entries.find((e) => e.name === "Front Squat");
      return (
        original?.logs[0].done &&
        original.logs[0].weight === "35" &&
        added?.logs.every((l) => !l.done && l.actual === "" && l.weight === "")
      );
    })
    .toBe(true);
  await expect(page.locator(".exercise-library")).toHaveCount(0);
  await page.screenshot({
    path: "/tmp/buff-inline-workout-mobile.png",
    fullPage: false,
  });
});

test("older text-only program exercises are recognized and can be swapped from the edit dialog", async ({
  page,
  baseURL,
}) => {
  const entry = exercise("Back Squat", 4, 8, "reps", 115);
  delete entry.libraryId;
  const state = {
    version: 1,
    unit: "lbs",
    programs: [],
    workouts: [
      {
        id: "legacy-mcp",
        name: "MCP leg day",
        date: key(new Date()),
        note: "",
        exercises: [entry],
      },
    ],
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
  await editPlannedExercise(page, "Back Squat");
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator(".selected-exercise-card")).toContainText(
    "EXERCISE LIBRARY",
  );
  await expect(
    dialog.getByRole("button", { name: "How to: Back Squat", exact: true }),
  ).toBeVisible();
  await expect(dialog.locator(".exercise-library")).toHaveCount(0);
  await dialog
    .getByRole("button", { name: "Swap exercise: Back Squat", exact: true })
    .click();
  await page.getByLabel("Exercise name", { exact: true }).fill("front squat");
  await page
    .getByRole("button", {
      name: "Front Squat Legs · Barbell · Reps",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Swap exercise →", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start workout", exact: false })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Swap exercise: Front Squat",
      exact: true,
    }),
  ).toBeVisible();
  const saved = await page.evaluate(() => window.readTestJournal());
  expect(saved.workouts[0].exercises[0].libraryId).toBe("front-squat");
  expect(saved.workouts[0].exercises[0].sets).toBe(4);
});
