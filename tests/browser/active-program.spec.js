import { test, expect } from "./auth-fixture.js";
import { exercise } from "../../src/model.js";
test("started programs persist and advance after completed sets, including undo and completion", async ({
  page,
  baseURL,
  browser,
}) => {
  const program = {
    id: "focus",
    name: "My strength block",
    weeks: 4,
    startDate: "2026-10-26",
    note: "",
  };
  const workouts = ["First session", "Second session"].map((name, i) => ({
    id: "session-" + i,
    name,
    date: `2026-10-${26 + i}`,
    note: "",
    programId: program.id,
    exercises: [exercise("Squat", 1, 8, "reps", 95)],
  }));
  await page.request
    .put(baseURL + "/api/state", {
      headers: { Origin: baseURL },
      data: {
        state: { version: 1, unit: "lbs", programs: [program], workouts },
        revision: 0,
      },
    })
    .then((r) => expect(r.ok()).toBeTruthy());
  await page.goto("/");
  await page.getByRole("button", { name: /Programs/ }).click();
  await page
    .getByRole("button", { name: "Start program →", exact: true })
    .click();
  const next = page.getByRole("region", { name: "Next workout" });
  await expect(
    next.getByRole("heading", { name: "First session" }),
  ).toBeVisible();
  await expect(page.locator("#sync-label")).toContainText("Synced");
  const remote = await (await page.request.get("/api/state")).json();
  expect(remote.state.activeProgramId).toBe("focus");
  const otherDevice = await browser.newContext({
    storageState: { cookies: await page.context().cookies(), origins: [] },
    viewport: { width: 390, height: 844 },
  });
  const phone = await otherDevice.newPage();
  await phone.goto(baseURL);
  await expect(
    phone
      .getByRole("region", { name: "Next workout" })
      .getByRole("heading", { name: "First session" }),
  ).toBeVisible();
  expect(
    await phone.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await phone.screenshot({
    path: "/tmp/buff-program-home-mobile.png",
    fullPage: true,
  });
  await otherDevice.close();
  await page.reload();
  await expect(
    next.getByRole("heading", { name: "First session" }),
  ).toBeVisible();
  await next.getByRole("button", { name: "Log workout" }).click();
  await page.getByLabel("Squat set 1 completed").check();
  await page.getByRole("button", { name: "Done logging" }).click();
  await expect(
    next.getByRole("heading", { name: "Second session" }),
  ).toBeVisible();
  const first = page
    .locator(".home-workout")
    .filter({ hasText: "First session" });
  await expect(first).toHaveClass(/workout-complete/);
  await first.getByRole("button", { name: "View log" }).click();
  await page.getByLabel("Squat set 1 completed").uncheck();
  await page.getByRole("button", { name: "Done logging" }).click();
  await expect(
    next.getByRole("heading", { name: "First session" }),
  ).toBeVisible();
  for (let i = 0; i < 2; i++) {
    await next.getByRole("button", { name: "Log workout" }).click();
    await page.getByLabel("Squat set 1 completed").check();
    await page.getByRole("button", { name: "Done logging" }).click();
  }
  await expect(
    next.getByText("Every workout completed. Well done!"),
  ).toBeVisible();
  await expect(page.locator(".home-workout.workout-complete")).toHaveCount(2);
});
