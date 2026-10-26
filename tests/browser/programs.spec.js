import { navigateTo } from "./navigation.js";
import { test, expect } from "./auth-fixture.js";
async function createProgram(page, name, weeks) {
  await navigateTo(page, "programs");
  await page
    .getByRole("button", { name: "Create program", exact: false })
    .first()
    .click();
  await page.getByLabel("Program name").fill(name);
  await page.getByLabel("Number of weeks").fill(String(weeks));
  await page.getByLabel("Start date", { exact: true }).fill("2026-11-02");
  await page
    .getByRole("button", { name: "Create program →", exact: true })
    .click();
}
async function addWorkout(page, name) {
  await page
    .getByRole("button", { name: "Plan a workout", exact: false })
    .first()
    .click();
  await page.getByLabel("Workout name").fill(name);
  await page
    .getByRole("button", { name: "Create workout →", exact: true })
    .click();
}
test("plans a custom program, logs a workout, copies a week and safely deletes only its grouping", async ({
  page,
}) => {
  await page.goto("/app");
  await createProgram(page, "Strength block", 4);
  await expect(
    page.getByRole("heading", { name: "Strength block", exact: true }),
  ).toBeVisible();
  await addWorkout(page, "Upper strength");
  await page
    .getByRole("button", { name: "Add exercise", exact: false })
    .click();
  await page.getByLabel("Exercise name").fill("Bench press");
  await page.getByLabel("Sets", { exact: true }).fill("2");
  await page
    .getByRole("button", { name: "Add exercise →", exact: true })
    .click();
  await page.getByRole("button", { name: "Log workout" }).click();
  await page.getByLabel("Bench press set 1 weight", { exact: true }).fill("40");
  await page.getByLabel("Bench press set 1 reps", { exact: true }).fill("8");
  await page.getByLabel("Bench press set 1 completed", { exact: true }).check();
  await page.getByRole("button", { name: "Collapse workout" }).click();
  await expect(page.locator(".workout-card")).toContainText("1 sets completed");
  await page.getByRole("button", { name: "Copy week", exact: true }).click();
  await page.getByLabel("Destination week").selectOption("2");
  await page
    .getByRole("button", { name: "Copy workouts →", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: /^Week 2/ })).toBeVisible();
  await expect(page.locator(".workout-card")).toContainText("0 sets completed");
  await page
    .getByRole("button", { name: "Week 1 1 workout", exact: true })
    .click();
  await expect(page.locator(".workout-card")).toContainText("1 sets completed");
  await page.getByRole("button", { name: "Edit program", exact: true }).click();
  await page.getByLabel("Number of weeks").fill("1");
  await page
    .getByRole("button", { name: "Save program →", exact: true })
    .click();
  await expect(page.locator(".form-error")).toContainText(
    "outside the program",
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.reload();
  await navigateTo(page, "programs");
  await page.getByRole("button", { name: "Open program" }).click();
  await expect(page.locator(".program-weeks")).toContainText("Week 4");
  await page.getByRole("button", { name: "Edit program", exact: true }).click();
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Delete program", exact: true })
    .click();
  await navigateTo(page, "planner");
  const data = await page.evaluate(() => window.readTestJournal());
  expect(data.programs).toHaveLength(0);
  expect(data.workouts.filter((w) => w.name === "Upper strength")).toHaveLength(
    2,
  );
  expect(
    data.workouts.find((w) => w.name === "Upper strength").exercises[0].logs[0]
      .done,
  ).toBe(true);
  expect(data.workouts.some((w) => w.programId)).toBe(false);
});
test("supports ten-week and longer programs with individual numbered weeks on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app");
  await createProgram(page, "Ten-week build", 10);
  await page.getByLabel("Go to program week").selectOption("10");
  await addWorkout(page, "Final week workout");
  await expect(page.getByRole("heading", { name: /^Week 10/ })).toBeVisible();
  await expect(page.locator(".workout-card")).toContainText(
    "Final week workout",
  );
  await page.getByRole("button", { name: "Edit plan", exact: true }).click();
  await expect(page.locator('select[name="programWeek"]')).toHaveValue("10");
  await expect(page.getByLabel("Date", { exact: true })).toHaveValue(
    "2027-01-04",
  );
  await page.getByLabel("Date", { exact: true }).fill("");
  await page.locator('select[name="programWeek"]').selectOption("9");
  await expect(page.getByLabel("Date", { exact: true })).toHaveValue(
    "2026-12-28",
  );
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("heading", { name: /^Week 9/ })).toBeVisible();
  await page.getByRole("button", { name: "Edit plan", exact: true }).click();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "All programs" }).click();
  await createProgram(page, "Long build", 26);
  await page.getByLabel("Go to program week").selectOption("26");
  await expect(page.getByRole("heading", { name: /^Week 26/ })).toBeVisible();
  await expect(page.locator(".workout-card")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/tmp/buff-program-mobile.png",
    fullPage: true,
  });
});
test("programs and their workouts sync across two separate devices", async ({
  browser,
}) => {
  const aContext = await browser.newContext(),
    bContext = await browser.newContext();
  const a = await aContext.newPage(),
    b = await bContext.newPage();
  const email = `program-${Date.now()}@example.com`;
  try {
    await a.goto("/app");
    await auth(a, true);
    await createProgram(a, "Synced program", 10);
    await a.getByLabel("Go to program week").selectOption("10");
    await addWorkout(a, "Synced Week 10 workout");
    await expect(a.locator("#sync-label")).toContainText("Synced");
    async function auth(page, signup) {
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      if (signup)
        await page
          .getByRole("button", { name: "New to Buff? Create an account" })
          .click();
      await page.getByLabel("Email", { exact: true }).fill(email);
      await page.getByLabel(/^Password/).fill("program sync password");
      await page
        .getByRole("button", {
          name: signup ? "Create account →" : "Sign in →",
          exact: true,
        })
        .click();
      await expect(page.locator("#account-root")).toContainText(email);
      await page.getByRole("button", { name: "Close account" }).click();
      await expect(page.locator("#sync-label")).toContainText("Synced");
    }
    await b.goto("/app");
    await auth(b, false);
    await navigateTo(b, "programs");
    await expect(b.locator(".program-card")).toContainText("Synced program");
    await b.getByRole("button", { name: "Open program" }).click();
    await b.getByLabel("Go to program week").selectOption("10");
    await expect(b.locator(".workout-card")).toContainText(
      "Synced Week 10 workout",
    );
  } finally {
    await Promise.allSettled([aContext.close(), bContext.close()]);
  }
});

test("assigning an existing logged workout to a program preserves its identity, date and logs", async ({
  page,
}) => {
  await page.goto("/app");
  await expect(page.locator("[data-day].selected")).toBeVisible();
  const original = await page.evaluate(() => ({
    date: document.querySelector("[data-day].selected").dataset.day,
  }));
  await page.getByRole("button", { name: "Log workout" }).click();
  await page
    .getByLabel("Barbell bench press set 1 weight", { exact: true })
    .fill("40");
  await page
    .getByLabel("Barbell bench press set 1 reps", { exact: true })
    .fill("8");
  await page
    .getByLabel("Barbell bench press set 1 completed", { exact: true })
    .check();
  await page.getByRole("button", { name: "Collapse workout" }).click();
  const id = await page
    .locator('[data-action="edit-workout"]')
    .getAttribute("data-id");
  await createProgram(page, "Existing plan", 10);
  await page.getByRole("button", { name: "Edit program", exact: true }).click();
  await page.getByLabel("Start date", { exact: true }).fill(original.date);
  await page
    .getByRole("button", { name: "Save program →", exact: true })
    .click();
  await navigateTo(page, "planner");
  await page.getByRole("button", { name: "Edit plan", exact: true }).click();
  await page
    .locator('select[name="programId"]')
    .selectOption({ label: "Existing plan" });
  await expect(page.getByLabel("Date", { exact: true })).toHaveValue(
    original.date,
  );
  await page.getByRole("button", { name: "Save changes" }).click();
  await navigateTo(page, "programs");
  await expect(page.locator(".workout-card")).toContainText("1 sets completed");
  const saved = await page.evaluate(() => window.readTestJournal());
  expect(saved.workouts).toHaveLength(1);
  expect(saved.workouts[0].id).toBe(id);
  expect(saved.workouts[0].date).toBe(original.date);
  expect(saved.workouts[0].exercises[0].logs[0].done).toBe(true);
});
