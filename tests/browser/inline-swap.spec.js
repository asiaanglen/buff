import { editPlannedExercise } from "./exercise-navigation.js";
import { exercise, key } from "../../src/model.js";
import { test, expect } from "./auth-fixture.js";
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
    .getByLabel("Search exercises", { exact: true })
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
  await page
    .getByRole("button", { name: "Swap exercise →", exact: true })
    .click();
  await expect(
    card.getByRole("heading", {
      name: "Incline Dumbbell Bench Press",
      exact: true,
    }),
  ).toBeVisible();
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
  // Recorded results cannot be reassigned to a different movement.
  await expect(
    replacement.getByRole("button", {
      name: "Swap exercise: Incline Dumbbell Bench Press",
      exact: true,
    }),
  ).toBeDisabled();
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
  await page
    .getByLabel("Search exercises", { exact: true })
    .fill("front squat");
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
