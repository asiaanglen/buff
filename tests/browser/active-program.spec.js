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
  await page
    .getByRole("button", { name: "Start program & align →", exact: true })
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
  await next.getByRole("button", { name: "Start workout" }).click();
  await page.getByLabel("Squat set 1 completed").click();
  await expect(
    next.getByRole("heading", { name: "Second session" }),
  ).toBeVisible();
  const first = page
    .locator(".home-workout")
    .filter({ hasText: "First session" });
  await expect(first).toHaveClass(/workout-complete/);
  await first.getByRole("button", { name: "View log" }).click();
  await page.getByLabel("Squat set 1 completed").uncheck();
  await page.getByRole("button", { name: "Collapse workout" }).click();
  await expect(
    next.getByRole("heading", { name: "First session" }),
  ).toBeVisible();
  for (let i = 0; i < 2; i++) {
    await next.getByRole("button", { name: "Start workout" }).click();
    await page.getByLabel("Squat set 1 completed").click();
  }
  await expect(
    next.getByText("Every workout completed. Well done!"),
  ).toBeVisible();
  await expect(page.locator(".home-workout.workout-complete")).toHaveCount(2);
});

test("switching programs requires confirmation and preserves completed workouts and exercise history", async ({
  page,
  baseURL,
}) => {
  const { navigateTo } = await import("./navigation.js");
  const programs = ["Current block", "New block"].map((name, i) => ({
    id: "switch-" + i,
    name,
    weeks: 4,
    startDate: "2026-10-26",
    note: "",
    ...(i ? { unenrolled: true } : {}),
  }));
  const completed = exercise("Back Squat", 1, 5, "reps", 100);
  completed.logs[0] = { weight: "105", actual: "5", done: true };
  completed.note = "Keep exercise history";
  const workouts = [
    {
      id: "done",
      name: "Finished session",
      programId: programs[0].id,
      date: "2026-10-26",
      note: "",
      exercises: [completed],
    },
    {
      id: "upcoming",
      name: "Old upcoming session",
      programId: programs[0].id,
      date: "2026-10-27",
      note: "",
      exercises: [exercise("Plank", 1)],
    },
    {
      id: "new",
      name: "New session",
      programId: programs[1].id,
      date: "2026-10-27",
      note: "",
      exercises: [exercise("Plank", 1)],
    },
  ];
  expect(
    (
      await page.request.put("/api/state", {
        headers: { Origin: baseURL },
        data: {
          revision: 0,
          state: {
            version: 1,
            unit: "lbs",
            programs,
            workouts,
            activeProgramId: programs[0].id,
          },
        },
      })
    ).ok(),
  ).toBeTruthy();
  await page.goto("/");
  await navigateTo(page, "programs");
  const target = page
    .locator(".program-card")
    .filter({
      has: page.getByRole("heading", { name: "New block", exact: true }),
    });
  await expect(
    target.getByRole("button", { name: "View Program →", exact: true }),
  ).toBeVisible();
  page.once("dialog", async (d) => {
    expect(d.message()).toContain("one program at a time");
    expect(d.message()).toContain(
      "exercise history and completed workouts will be saved",
    );
    await d.dismiss();
  });
  await target
    .getByRole("button", { name: "Start program →", exact: true })
    .click();
  await expect(page.locator("#start-program-form")).toHaveCount(0);
  expect(
    (await (await page.request.get("/api/state")).json()).state.activeProgramId,
  ).toBe(programs[0].id);
  page.once("dialog", (d) => d.accept());
  await target
    .getByRole("button", { name: "Start program →", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start program & align →", exact: true })
    .click();
  await expect(page.locator("#sync-label")).toContainText("Synced");
  const saved = (await (await page.request.get("/api/state")).json()).state;
  expect(saved.activeProgramId).toBe(programs[1].id);
  expect(saved.programs[0].unenrolled).toBe(true);
  expect(saved.workouts[0]).toEqual(workouts[0]);
  await navigateTo(page, "planner");
  await expect(page.locator('[data-calendar-workout="upcoming"]')).toHaveCount(
    0,
  );
  await expect(page.locator('[data-calendar-workout="new"]')).toBeVisible();
  await navigateTo(page, "history");
  await expect(page.locator(".history-card")).toContainText("Finished session");
  await page.reload();
  expect(
    (await (await page.request.get("/api/state")).json()).state.activeProgramId,
  ).toBe(programs[1].id);
});
