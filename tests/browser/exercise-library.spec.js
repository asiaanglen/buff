import { workoutTool } from "./exercise-navigation.js";
import { test, expect } from "./auth-fixture.js";
test("exercise library searches aliases and variations, supports timed exercises and custom names", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const card = page.locator(".workout-card").first();
  await workoutTool(page, card, "Add exercise");
  await page.getByLabel("Search exercises", { exact: true }).fill("RDL");
  await expect(
    page.getByRole("button", {
      name: "Romanian Deadlift Legs · Barbell · Reps",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Romanian Deadlift Legs · Barbell · Reps",
      exact: true,
    })
    .click();
  await expect(page.getByLabel("Exercise name", { exact: true })).toHaveValue(
    "Romanian Deadlift",
  );
  await page
    .getByRole("button", { name: "Add exercise", exact: false })
    .last()
    .click();
  await expect(
    card.getByText("Romanian Deadlift", { exact: true }),
  ).toBeVisible();
  await workoutTool(page, card, "Add exercise");
  await page
    .getByLabel("Search exercises", { exact: true })
    .fill("neutral grip pull up");
  await page
    .getByRole("button", {
      name: "Neutral Grip Pull Up Back · Pull-up bar · Reps",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Add exercise", exact: false })
    .last()
    .click();
  await expect(
    card.getByText("Neutral Grip Pull Up", { exact: true }),
  ).toBeVisible();
  await workoutTool(page, card, "Add exercise");
  await page.getByLabel("Search exercises", { exact: true }).fill("plank");
  await page.getByLabel("Muscle group", { exact: true }).selectOption("Core");
  await page
    .getByRole("button", {
      name: "Plank Core · Bodyweight · Timed",
      exact: true,
    })
    .click();
  await expect(page.getByLabel("Track by")).toHaveValue("time");
  await expect(page.getByLabel("Target per set")).toHaveValue("45");
  await page
    .getByRole("button", { name: "Add exercise", exact: false })
    .last()
    .click();
  await workoutTool(page, card, "Add exercise");
  await page
    .getByLabel("Search exercises", { exact: true })
    .fill("my special movement");
  await expect(
    page.getByText("No matching exercises.", { exact: false }),
  ).toBeVisible();
  await page
    .getByLabel("Exercise name", { exact: true })
    .fill("My special movement");
  await page
    .getByRole("button", { name: "Add exercise", exact: false })
    .last()
    .click();
  await expect(
    card.getByText("My special movement", { exact: true }),
  ).toBeVisible();
  await workoutTool(page, card, "Add exercise");
  await page.getByLabel("Search exercises", { exact: true }).fill("my special");
  await expect(
    page.getByRole("button", {
      name: "My special movement From your workouts",
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("typing directly into Exercise name opens matching library results, including when swapping", async ({
  page,
}) => {
  await page.goto("/");
  const card = page.locator(".workout-card").first();
  await workoutTool(page, card, "Add exercise");
  await page.getByLabel("Exercise name", { exact: true }).fill("front squat");
  await page
    .getByRole("button", {
      name: "Front Squat Legs · Barbell · Reps",
      exact: true,
    })
    .click();
  await expect(page.getByLabel("Exercise name", { exact: true })).toHaveValue(
    "Front Squat",
  );
  await page
    .getByRole("button", { name: "Add exercise", exact: false })
    .last()
    .click();
  await card
    .getByRole("button", { name: "Start workout", exact: false })
    .click();
  await card
    .getByRole("button", { name: "Swap exercise: Front Squat", exact: true })
    .click();
  await page.getByLabel("Exercise name", { exact: true }).fill("back squat");
  await expect(
    page.getByRole("button", {
      name: "Back Squat Legs · Barbell · Reps",
      exact: true,
    }),
  ).toBeVisible();
});

test("cable kickbacks and split squats can be selected with their guides and stable library links", async ({
  page,
}) => {
  await page.goto("/");
  const card = page.locator(".workout-card").first();
  for (const [query, name, equipment, id, cue] of [
    [
      "cable kickbacks",
      "Cable Kickback",
      "Cable",
      "cable-kickback",
      "ankle strap",
    ],
    [
      "split squats",
      "Split Squat",
      "Bodyweight",
      "split-squat",
      "both feet on the floor",
    ],
  ]) {
    await workoutTool(page, card, "Add exercise");
    await page.getByLabel("Search exercises", { exact: true }).fill(query);
    await page
      .getByRole("button", { name: `How to: ${name}`, exact: true })
      .click();
    await expect(page.locator("#exercise-guide")).toContainText(cue);
    await page.keyboard.press("Escape");
    await page
      .getByRole("button", {
        name: `${name} Legs · ${equipment} · Reps`,
        exact: true,
      })
      .click();
    await page
      .getByRole("button", { name: "Add exercise →", exact: true })
      .click();
    expect(
      (
        await page.evaluate(() => window.readTestJournal())
      ).workouts[0].exercises.find((e) => e.name === name).libraryId,
    ).toBe(id);
  }
});
