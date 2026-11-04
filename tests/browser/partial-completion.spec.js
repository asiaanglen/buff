import { test, expect } from "./auth-fixture.js";
import { exercise, key, addDays } from "../../src/model.js";
import { navigateTo } from "./navigation.js";
test("finishing a partial workout shows set counts, advances the program, keeps blank sets, and syncs completion", async ({
  page,
  browser,
  baseURL,
}) => {
  const today = key(new Date());
  const program = {
    id: "partial-plan",
    name: "Partial completion plan",
    startDate: today,
    weeks: 4,
    note: "",
  };
  const workouts = [0, 1].map((i) => ({
    id: "finish-" + i,
    programId: program.id,
    name: i ? "Next session" : "Current session",
    date: addDays(today, i),
    note: "",
    exercises: [
      exercise("Back Squat", 2, 8, "reps", 95),
      exercise("Plank", 1, 45, "time", 0),
    ],
  }));
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
  await page
    .getByRole("region", { name: "Next workout", exact: true })
    .getByRole("button", { name: "Start workout", exact: false })
    .click();
  await page.getByLabel("Back Squat set 1 reps", { exact: true }).fill("6");
  await page.getByLabel("Back Squat set 1 completed", { exact: true }).check();
  await expect(
    page.getByLabel("Back Squat set 1 weight", { exact: true }),
  ).toHaveValue("");
  // Filled results can be accepted by the finish action without checking every set.
  await page
    .getByRole("button", { name: "Mark as complete", exact: true })
    .click();
  await expect(page.locator(".workout-completion-message")).toHaveText(
    "Congrats! You completed 1 out of 3 sets.",
  );
  await expect(
    page.getByRole("region", { name: "Next workout", exact: true }),
  ).toContainText("Next session");
  await expect(page.locator("#sync-label")).toContainText("Synced");
  const saved = await (await page.request.get("/api/state")).json();
  const first = saved.state.workouts[0];
  expect(first.completed).toBe(true);
  expect(first.exercises[0].logs[0]).toEqual({
    weight: "",
    actual: "6",
    done: true,
  });
  expect(first.exercises[0].logs[1]).toEqual({
    weight: "",
    actual: "",
    done: false,
  });
  expect(first.exercises[1].logs[0]).toEqual({
    weight: "",
    actual: "",
    done: false,
  });
  await navigateTo(page, "history");
  await expect(page.locator(".history-card")).toContainText("Current session");
  await expect(page.locator(".history-card")).toContainText(
    "1 of 3 sets logged",
  );
  await page.reload();
  await navigateTo(page, "history");
  await expect(page.locator(".history-card")).toContainText("Current session");
  const other = await browser.newContext({
    baseURL,
    storageState: { cookies: await page.context().cookies(), origins: [] },
  });
  try {
    const second = await other.newPage();
    await second.goto("/");
    await expect(
      second.getByRole("region", { name: "Next workout", exact: true }),
    ).toContainText("Next session");
  } finally {
    await other.close();
  }
  await navigateTo(page, "home");
  await page
    .getByRole("region", { name: "Next workout", exact: true })
    .getByRole("button", { name: "Start workout", exact: false })
    .click();
  await page
    .getByRole("button", { name: "Mark as complete", exact: true })
    .click();
  await expect(page.locator(".workout-completion-message")).toHaveText(
    "Congrats! You completed 0 out of 3 sets.",
  );
  await expect(
    page.getByRole("region", { name: "Next workout", exact: true }),
  ).toContainText("Every workout completed");
});
