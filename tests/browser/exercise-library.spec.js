import { test, expect } from "./auth-fixture.js";
test("exercise library searches aliases and variations, supports timed exercises and custom names", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const card = page.locator(".workout-card").first();
  await card.getByRole("button", { name: "Add exercise" }).click();
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
  await card.getByRole("button", { name: "Add exercise" }).click();
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
  await card.getByRole("button", { name: "Add exercise" }).click();
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
  await card.getByRole("button", { name: "Add exercise" }).click();
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
  await card.getByRole("button", { name: "Add exercise" }).click();
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

test("typing directly into Exercise name opens matching library results, including when editing", async ({
  page,
}) => {
  await page.goto("/");
  const card = page.locator(".workout-card").first();
  await card.getByRole("button", { name: "Add exercise" }).click();
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
    .getByRole("button", { name: "Edit Front Squat", exact: true })
    .click();
  await page.getByLabel("Exercise name", { exact: true }).fill("back squat");
  await expect(
    page.getByRole("button", {
      name: "Back Squat Legs · Barbell · Reps",
      exact: true,
    }),
  ).toBeVisible();
});
