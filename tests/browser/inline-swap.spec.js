import { test, expect } from "./auth-fixture.js";
test("exercise dropdown logs in place and opens the library only for swapping, retaining instructions", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const card = page.locator(".workout-card").first();
  await card.locator('[data-action="expand-exercise"]').first().click();
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
  await accordion
    .getByRole("button", { name: "How to: Barbell Bench Press", exact: true })
    .click();
  await expect(page.locator("#exercise-guide")).toBeVisible();
  await page.keyboard.press("Escape");
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
