import { signupProfile } from "../signup-profile.js";
import { workoutTool } from "./exercise-navigation.js";
import { test, expect } from "./auth-fixture.js";
test("exercise library searches aliases and variations, supports timed exercises and custom names", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const card = page.locator(".workout-card").first();
  await workoutTool(page, card, "Add exercise");
  await page.getByLabel("Exercise name", { exact: true }).fill("RDL");
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
    .getByLabel("Exercise name", { exact: true })
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
  await page.getByLabel("Exercise name", { exact: true }).fill("plank");
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
    .getByLabel("Exercise name", { exact: true })
    .fill("my special movement");
  await expect(
    page.getByText("No matching exercises", { exact: false }),
  ).toBeVisible();
  await page
    .getByLabel("Exercise name", { exact: true })
    .fill("My special movement");
  await page
    .getByRole("button", { name: "Add exercise", exact: false })
    .last()
    .click();
  const popup = page.locator("#personal-exercise-dialog");
  await expect(popup).toBeVisible();
  await popup
    .getByLabel("Instructions")
    .fill("Brace your core, then move slowly.");
  await popup
    .getByRole("button", { name: "Save exercise", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add exercise →", exact: true })
    .click();
  await expect(
    card.getByText("My special movement", { exact: true }),
  ).toBeVisible();
  await workoutTool(page, card, "Add exercise");
  await page.getByLabel("Exercise name", { exact: true }).fill("my special");
  await expect(
    page.getByRole("button", {
      name: "My special movement Your library · Reps · Weighted",
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
    await page.getByLabel("Exercise name", { exact: true }).fill(query);
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

test("personal exercises keep instructions and tracking private, sync to another device, and preserve the workout draft", async ({
  page,
  baseURL,
  browser,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const card = page.locator(".workout-card").first();
  await workoutTool(page, card, "Add exercise");
  await expect(
    page.getByLabel("Search exercises", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Muscle group", { exact: true })).toHaveCount(0);
  await page
    .getByLabel("Exercise name", { exact: true })
    .fill("Alex balance hold");
  await page.getByLabel("Sets", { exact: true }).fill("2");
  await page.getByLabel("Target per set").fill("20");
  await page.getByRole("button", { name: "Add New Exercise" }).click();
  let popup = page.locator("#personal-exercise-dialog");
  await popup
    .getByLabel("Instructions")
    .fill("Stand tall.\nBalance on one leg and breathe steadily.");
  await popup.getByLabel("Track by").selectOption("time");
  await popup.getByLabel("Track weight (lbs)").uncheck();
  await popup
    .getByRole("button", { name: "Save exercise", exact: true })
    .click();
  const form = page.locator("#exercise-form");
  await expect(form.getByLabel("Sets", { exact: true })).toHaveValue("2");
  await expect(form.getByLabel("Track by")).toHaveValue("time");
  await expect(form.getByLabel("Planned weight (lbs)")).toHaveAttribute(
    "readonly",
    "",
  );
  await form
    .getByRole("button", { name: "Add exercise →", exact: true })
    .click();
  await card
    .getByRole("button", { name: /^(Start|Resume) workout/, exact: true })
    .click();
  await card
    .getByRole("heading", { name: "Alex balance hold", exact: true })
    .click();
  await expect(
    card.getByRole("list", { name: "Alex balance hold instructions" }),
  ).toContainText("Balance on one leg");
  await expect(
    page.getByLabel("Alex balance hold set 1 weight", { exact: true }),
  ).toHaveAttribute("readonly", "");
  await page
    .getByLabel("Alex balance hold set 1 completed", { exact: true })
    .check();
  await card.getByRole("button", { name: "Collapse workout" }).click();
  await expect(page.locator("#sync-label")).toContainText("Synced");
  const saved = await (await page.request.get("/api/state")).json();
  expect(saved.state.customExercises).toHaveLength(1);
  expect(saved.state.customExercises[0]).toMatchObject({
    name: "Alex balance hold",
    mode: "time",
    weighted: false,
  });
  const context = await browser.newContext({
    storageState: { cookies: await page.context().cookies(), origins: [] },
    viewport: { width: 390, height: 844 },
  });
  const phone = await context.newPage();
  await phone.goto(baseURL);
  await workoutTool(
    phone,
    phone.locator(".workout-card").first(),
    "Add exercise",
  );
  await phone.getByLabel("Exercise name", { exact: true }).fill("alex balance");
  await expect(
    phone.getByRole("button", {
      name: "Alex balance hold Your library · Timed · Bodyweight",
      exact: true,
    }),
  ).toBeVisible();
  await phone.screenshot({
    path: "/tmp/buff-personal-exercise-mobile.png",
    fullPage: true,
  });
  await context.close();
  // A second account does not receive the first account's definition or suggestions.
  const other = await browser.newContext({
    extraHTTPHeaders: { "CF-Connecting-IP": "198.18.251.16" },
  });
  const { passwordProof, authScheme } =
    await import("../../src/credentials.js");
  const email = `private-library-${crypto.randomUUID()}@example.com`;
  const signup = await other.request.post(baseURL + "/api/auth/signup", {
    headers: { Origin: baseURL },
    data: {
      email,
      password: await passwordProof(email, "private library password"),
      ...signupProfile,
      credentialVersion: authScheme,
    },
  });
  expect(signup.ok()).toBeTruthy();
  const otherPage = await other.newPage();
  await otherPage.goto(baseURL);
  await workoutTool(
    otherPage,
    otherPage.locator(".workout-card").first(),
    "Add exercise",
  );
  await otherPage
    .getByLabel("Exercise name", { exact: true })
    .fill("Alex balance hold");
  await expect(
    otherPage.getByText("No matching exercises", { exact: true }),
  ).toBeVisible();
  await expect(
    otherPage.getByRole("button", { name: "Add New Exercise" }),
  ).toBeVisible();
  await expect(
    otherPage.locator("[data-action=choose-personal-exercise]"),
  ).toHaveCount(0);
  await other.close();
});
