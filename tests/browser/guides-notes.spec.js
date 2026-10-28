import { workoutTool } from "./exercise-navigation.js";
import { test, expect } from "./auth-fixture.js";
import { exercise, addDays, key } from "../../src/model.js";
test("guides open from the library, plan and workout log without losing edits; notes sync and appear in history", async ({
  page,
  baseURL,
  browser,
}) => {
  const date = key(new Date());
  const past = {
    id: "past-notes",
    name: "Last training day",
    date: addDays(date, -7),
    note: "",
    exercises: [
      exercise("Back Squat", 1, 8, "reps", 95),
      exercise("Plank", 1, 45, "time"),
    ],
  };
  past.exercises[0].logs[0] = { weight: "100", actual: "7", done: true };
  past.exercises[0].note = "Keep elbows under the bar.";
  past.exercises[1].logs[0] = { weight: "0", actual: "50", done: true };
  past.exercises[1].note = "Steady breathing.";
  const current = {
    id: "current-notes",
    name: "Today training",
    date,
    note: "",
    exercises: [exercise("Back Squat", 1, 8, "reps", 95)],
  };
  const future = {
    id: "future-notes",
    name: "Next training",
    date: addDays(date, 7),
    note: "",
    exercises: [exercise("Back Squat", 1, 8, "reps", 95)],
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
            workouts: [past, current, future],
          },
          revision: 0,
        },
      })
    ).ok(),
  ).toBeTruthy();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const card = page
    .locator(".workout-card")
    .filter({ hasText: "Today training" });
  await card
    .getByRole("button", { name: "Start workout", exact: false })
    .click();
  await expect(
    card.getByRole("list", { name: "Back Squat instructions", exact: true }),
  ).toBeVisible();
  await expect(
    card.getByRole("button", { name: "How to: Back Squat", exact: true }),
  ).toHaveCount(0);
  await card
    .getByRole("button", { name: "Collapse workout", exact: false })
    .click();
  await workoutTool(page, card, "Add exercise");
  await page.getByLabel("Exercise name", { exact: true }).fill("plank");
  await page
    .getByRole("button", { name: "How to: Plank", exact: true })
    .click();
  await expect(page.locator("#exercise-guide")).toContainText(
    "Place forearms on the floor",
  );
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("heading", { name: "Add an exercise" }),
  ).toBeVisible();
  await expect(page.getByLabel("Exercise name", { exact: true })).toHaveValue(
    "plank",
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
  await card.getByRole("button", { name: "Start workout" }).click();
  await page.locator(".workout-history summary").click();
  await expect(page.locator(".workout-history")).toContainText(
    "100 lbs × 7 reps",
  );
  await expect(page.locator(".workout-history")).toContainText(
    "Keep elbows under the bar.",
  );
  await page.getByLabel("Back Squat set 1 weight", { exact: true }).fill("105");
  await page
    .getByLabel("Notes for Back Squat", { exact: true })
    .fill("Strong today.\nUse the same stance next time.");
  await expect(
    page.getByRole("list", { name: "Back Squat instructions", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Back Squat set 1 weight", { exact: true }),
  ).toHaveValue("105");
  await expect(
    page.getByLabel("Notes for Back Squat", { exact: true }),
  ).toHaveValue("Strong today.\nUse the same stance next time.");
  await page
    .getByRole("button", { name: "Mark as complete", exact: true })
    .click();
  await expect(page.locator("#sync-label")).toContainText("Synced");
  const saved = await (await page.request.get("/api/state")).json();
  expect(saved.state.workouts[1].exercises[0].note).toBe(
    "Strong today.\nUse the same stance next time.",
  );
  const other = await browser.newContext({
    storageState: { cookies: await page.context().cookies(), origins: [] },
  });
  const next = await other.newPage();
  await next.goto(baseURL);
  await next.getByRole("button", { name: "Next week", exact: true }).click();
  await next.locator(`[data-day="${future.date}"]`).click();
  await next.getByRole("button", { name: "Start workout" }).click();
  await next.locator(".workout-history summary").click();
  await expect(next.locator(".workout-history")).toContainText(
    "105 lbs × 8 reps",
  );
  await expect(next.locator(".workout-history")).toContainText(
    "Use the same stance next time.",
  );
  await other.close();
});

test("YouTube demonstrations save privately, load only on play and close cleanly", async ({
  page,
  browser,
  baseURL,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("https://www.youtube-nocookie.com/**", (route) =>
    route.fulfill({ contentType: "text/html", body: "Video fixture" }),
  );
  expect(
    (
      await page.request.put("/api/state", {
        headers: { Origin: baseURL },
        data: {
          revision: 0,
          state: {
            version: 1,
            unit: "lbs",
            workouts: [
              {
                id: "video-test",
                name: "Video session",
                date: key(new Date()),
                note: "",
                exercises: [exercise("Back Squat", 1)],
              },
            ],
          },
        },
      })
    ).ok(),
  ).toBeTruthy();
  await page.goto("/");
  await page
    .getByRole("button", { name: "Start workout", exact: false })
    .click();
  await page
    .getByRole("button", { name: "YouTube demonstration", exact: false })
    .first()
    .click();
  const dialog = page.locator("#exercise-video-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("iframe")).toHaveCount(0);
  await expect(
    dialog.getByRole("link", { name: "Find a video on YouTube", exact: false }),
  ).toHaveAttribute("href", /youtube.com\/results\?search_query=/);
  await dialog
    .getByLabel("YouTube video link", { exact: true })
    .fill("https://attacker.test/watch?v=rT7DgCr-3pg");
  await dialog.getByRole("button", { name: "Save video", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Enter a YouTube video link",
  );
  await dialog
    .getByLabel("YouTube video link", { exact: true })
    .fill("https://youtu.be/rT7DgCr-3pg?t=10");
  await dialog.getByRole("button", { name: "Save video", exact: true }).click();
  await expect(dialog.locator("iframe")).toHaveCount(0);
  await dialog
    .getByRole("button", { name: "Play demonstration", exact: false })
    .click();
  await expect(dialog.locator("iframe")).toHaveAttribute(
    "src",
    "https://www.youtube-nocookie.com/embed/rT7DgCr-3pg",
  );
  await dialog
    .getByRole("button", { name: "Close video", exact: true })
    .click();
  await expect(page.locator("iframe")).toHaveCount(0);
  await expect(page.locator("#sync-label")).toContainText("Synced");
  const other = await browser.newContext({
    storageState: { cookies: await page.context().cookies(), origins: [] },
  });
  try {
    const device = await other.newPage();
    await device.goto(baseURL);
    await expect(device.locator("#sync-label")).toContainText("Synced");
    const state = await device.evaluate(
      () =>
        JSON.parse(
          localStorage.getItem(
            Object.keys(localStorage).find((k) =>
              k.startsWith("buff-account-"),
            ),
          ),
        ).state,
    );
    expect(Object.values(state.exerciseVideos)).toContain(
      "https://www.youtube.com/watch?v=rT7DgCr-3pg",
    );
  } finally {
    await other.close();
  }
});
