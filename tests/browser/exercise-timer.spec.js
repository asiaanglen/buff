import { test, expect } from "./auth-fixture.js";
import { openExercise } from "./exercise-navigation.js";
test.use({ hasTouch: true });
test("timed exercises count down from targets, pause, reset, survive redraws, and finish without logging sets", async ({
  page,
}) => {
  await page.clock.install();
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/");
  await expect(page.locator(".exercise-countdown")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Start workout", exact: false })
    .first()
    .click();
  await openExercise(page, "Plank");
  const timer = page.getByRole("region", {
    name: "Plank set timer",
    exact: true,
  });
  const output = timer.getByRole("timer");
  await expect(output).toHaveText("0:45");
  await timer
    .getByRole("button", { name: "Add 15 seconds to Plank timer", exact: true })
    .tap();
  await expect(output).toHaveText("1:00");
  await timer
    .getByRole("button", { name: "Reset Plank timer", exact: true })
    .tap();
  await expect(output).toHaveText("0:45");
  expect(
    await timer.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true);
  await timer
    .getByRole("button", { name: "Start Plank timer", exact: true })
    .tap();
  await page.clock.fastForward(5000);
  await expect(output).toHaveText("0:40");
  await timer
    .getByRole("button", { name: "Add 30 seconds to Plank timer", exact: true })
    .tap();
  await expect(output).toHaveText("1:10");
  await timer
    .getByRole("button", { name: "Pause Plank timer", exact: true })
    .tap();
  await page.clock.fastForward(10000);
  await expect(output).toHaveText("1:10");
  await timer
    .getByRole("button", { name: "Add 15 seconds to Plank timer", exact: true })
    .tap();
  await expect(output).toHaveText("1:25");
  await expect(timer.getByRole("status")).toHaveText("Paused");
  await timer
    .getByRole("button", { name: "Reset Plank timer", exact: true })
    .tap();
  await expect(output).toHaveText("0:45");
  await timer
    .getByRole("button", { name: "Start Plank timer", exact: true })
    .tap();
  await page.clock.fastForward(10000);
  await page
    .getByRole("button", { name: "Add set to Plank", exact: true })
    .tap();
  await expect(output).toHaveText("0:35");
  await page.clock.fastForward(40000);
  await expect(output).toHaveText("0:00");
  await expect(timer.getByRole("status")).toContainText("Time’s up!");
  await timer
    .getByRole("button", { name: "Add 60 seconds to Plank timer", exact: true })
    .tap();
  await expect(output).toHaveText("1:00");
  await expect(
    page.getByLabel("Plank set 1 seconds", { exact: true }),
  ).toHaveValue("45");
  await expect(
    page.getByLabel("Plank set 1 completed", { exact: true }),
  ).not.toBeChecked();
  await timer
    .getByRole("button", { name: "Start Plank timer", exact: true })
    .tap();
  await expect(output).toHaveText("1:00");
  await page.clock.fastForward(60000);
  await expect(output).toHaveText("0:00");
  await timer
    .getByRole("button", { name: "Reset Plank timer", exact: true })
    .tap();
  await expect(output).toHaveText("0:45");
  await openExercise(page, "Barbell bench press");
  await expect(
    page.locator(".exercise-accordion[open] .exercise-countdown"),
  ).toHaveCount(0);
});
