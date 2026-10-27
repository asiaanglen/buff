import { test, expect } from "./auth-fixture.js";
import { exercise } from "../../src/model.js";
import { shiftDate } from "../../shared/programs.js";
async function seed(page, baseURL) {
  const today = await page.evaluate(() => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  });
  const entry = exercise("Back Squat", 1, 5, "reps", 95);
  entry.logs[0] = { weight: "105", actual: "4", done: true };
  entry.note = "Keep logged note";
  const workouts = [
    {
      id: "calendar-logged",
      programId: "calendar-program",
      name: "Logged strength",
      date: today,
      note: "Keep workout note",
      exercises: [entry],
    },
    {
      id: "calendar-second",
      programId: "calendar-program",
      name: "Second session",
      date: today,
      note: "",
      exercises: [exercise("Plank", 1, 30, "time")],
    },
  ];
  const state = {
    version: 1,
    unit: "lbs",
    programs: [
      {
        id: "calendar-program",
        name: "Calendar plan",
        weeks: 4,
        startDate: today,
        note: "",
      },
    ],
    workouts,
  };
  expect(
    (
      await page.request.put("/api/state", {
        headers: { Origin: baseURL },
        data: { state, revision: 0 },
      })
    ).ok(),
  ).toBeTruthy();
  await page.goto("/");
  await expect(page.locator("#sync-label")).toContainText("Synced");
  return { today, state };
}
test("month view drags one of several workouts to a new date and keeps completed logs across devices", async ({
  page,
  baseURL,
  browser,
}) => {
  const { today, state } = await seed(page, baseURL);
  const target = shiftDate(today, 1);
  await page.getByRole("button", { name: "Month", exact: true }).click();
  await expect(page.locator(".month-day")).toHaveCount(42);
  const currentMonth = await page
    .locator(".month-controls strong")
    .textContent();
  await page.getByRole("button", { name: "Next month", exact: true }).click();
  await expect(page.locator(".month-controls strong")).not.toHaveText(
    currentMonth,
  );
  await page
    .getByRole("button", { name: "Previous month", exact: true })
    .click();
  await expect(page.locator(".month-controls strong")).toHaveText(currentMonth);
  const source = page.locator('[data-calendar-workout="calendar-logged"]');
  await expect(source).toHaveClass(/calendar-workout-complete/);
  await source
    .locator("[data-calendar-handle]")
    .dragTo(page.locator(`[data-calendar-date="${target}"]`));
  await expect(page.locator("#calendar-status")).toContainText(
    "Moved Logged strength",
  );
  await expect(page.locator("#sync-label")).toContainText("Synced");
  const saved = (await (await page.request.get("/api/state")).json()).state;
  expect(saved.workouts).toHaveLength(2);
  expect(saved.workouts[0]).toEqual({ ...state.workouts[0], date: target });
  expect(saved.workouts[1]).toEqual(state.workouts[1]);
  await page.reload();
  await page.getByRole("button", { name: "Month", exact: true }).click();
  await expect(
    page.locator(
      `[data-calendar-date="${target}"] [data-calendar-workout="calendar-logged"]`,
    ),
  ).toBeVisible();
  const other = await browser.newContext({
    storageState: { cookies: await page.context().cookies(), origins: [] },
  });
  const device = await other.newPage();
  await device.goto(baseURL);
  await device.getByRole("button", { name: "Month", exact: true }).click();
  await expect(
    device.locator(`[data-calendar-date="${target}"]`),
  ).toContainText("Logged strength");
  await other.close();
});
test("week view supports dragging and invalid program moves leave all saved records unchanged", async ({
  page,
  baseURL,
}) => {
  const { today, state } = await seed(page, baseURL);
  const target = shiftDate(today, 1);
  // Use tomorrow if it is in this week; otherwise navigate to Month for the cross-week target.
  const weekday = new Date(today + "T00:00:00Z").getUTCDay();
  if (weekday === 0)
    await page.getByRole("button", { name: "Month", exact: true }).click();
  await page
    .locator('[data-calendar-workout="calendar-second"] [data-calendar-handle]')
    .dragTo(page.locator(`[data-calendar-date="${target}"]`));
  await expect(page.locator("#calendar-status")).toContainText(
    "Moved Second session",
  );
  await expect(page.locator("#sync-label")).toContainText("Synced");
  await page.getByRole("button", { name: "Month", exact: true }).click();
  await page.getByRole("button", { name: "Today", exact: true }).click();
  const invalid = (await page
    .locator(`[data-calendar-date="${shiftDate(today, -1)}"]`)
    .count())
    ? shiftDate(today, -1)
    : shiftDate(today, 28);
  const before = await (await page.request.get("/api/state")).json();
  await page
    .locator('[data-calendar-workout="calendar-logged"] [data-calendar-handle]')
    .dragTo(page.locator(`[data-calendar-date="${invalid}"]`));
  await expect(page.locator("#calendar-status")).toContainText(
    "Choose a date within this program",
  );
  expect(await (await page.request.get("/api/state")).json()).toEqual(before);
  expect(before.state.workouts[0]).toEqual(state.workouts[0]);
  expect(before.state.workouts[1].date).toBe(target);
});
test("phone touch handles and the Move date picker both reschedule without changing results", async ({
  page,
  baseURL,
  context,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { today, state } = await seed(page, baseURL);
  const target = shiftDate(today, 1);
  await page.getByRole("button", { name: "Month", exact: true }).click();
  const handle = page.locator(
    '[data-calendar-workout="calendar-logged"] [data-calendar-handle]',
  );
  await handle.scrollIntoViewIfNeeded();
  const from = await handle.boundingBox(),
    to = await page.locator(`[data-calendar-date="${target}"]`).boundingBox();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: from.x + from.width / 2, y: from.y + from.height / 2, id: 1 },
    ],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: to.x + to.width / 2, y: to.y + 20, id: 1 }],
  });
  await expect(page.locator(`[data-calendar-date="${target}"]`)).toHaveClass(
    /calendar-drop-target/,
  );
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(page.locator("#calendar-status")).toContainText(
    "Moved Logged strength",
  );
  await page.getByRole("button", { name: "Move", exact: true }).click();
  await page
    .getByLabel("Workout date", { exact: true })
    .fill(shiftDate(today, 2));
  await page.getByRole("button", { name: "Move workout", exact: true }).click();
  await expect(page.locator("#sync-label")).toContainText("Synced");
  const saved = (await (await page.request.get("/api/state")).json()).state;
  expect(saved.workouts[0]).toEqual({
    ...state.workouts[0],
    date: shiftDate(today, 2),
  });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page
      .locator(".month-calendar")
      .screenshot({ path: `/tmp/buff-calendar-month-${width}.png` });
  }
});

test("calendar messages and workouts are cleared when another account signs in on the same phone", async ({
  page,
  baseURL,
}) => {
  const { fillSignupProfile } = await import("../signup-profile.js");
  const { today } = await seed(page, baseURL);
  await page.getByRole("button", { name: "Month", exact: true }).click();
  await page
    .locator('[data-calendar-workout="calendar-logged"] [data-calendar-handle]')
    .dragTo(page.locator(`[data-calendar-date="${shiftDate(today, 1)}"]`));
  await expect(page.locator("#calendar-status")).toContainText(
    "Moved Logged strength",
  );
  await expect(page.locator("#sync-label")).toContainText("Synced");
  await page
    .getByRole("button", { name: "Account and cross-device sync", exact: true })
    .click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page
    .getByRole("button", { name: "Get started free", exact: false })
    .click();
  await fillSignupProfile(page);
  await page
    .getByLabel("Email", { exact: true })
    .fill(`calendar-other-${crypto.randomUUID()}@example.com`);
  await page.getByLabel(/^Password/).fill("x");
  await page
    .getByRole("button", { name: "Create account →", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your account", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Close account", exact: true })
    .click();
  await expect(page.locator(".sidebar")).toBeVisible();
  await expect(page.locator("#calendar-status")).toHaveCount(0);
  await expect(page.getByText("Logged strength", { exact: true })).toHaveCount(
    0,
  );
});

test("unenroll removes a program from both calendar views and can be reversed", async ({
  page,
  baseURL,
}) => {
  const { state } = await seed(page, baseURL);
  const { navigateTo } = await import("./navigation.js");
  await navigateTo(page, "programs");
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Unenroll", exact: true }).click();
  await expect(page.getByText("Not enrolled", { exact: true })).toBeVisible();
  await navigateTo(page, "planner");
  await expect(page.locator("[data-calendar-workout]")).toHaveCount(0);
  await expect(page.locator(".workout-card")).toHaveCount(0);
  await page.getByRole("button", { name: "Month", exact: true }).click();
  await expect(page.locator("[data-calendar-workout]")).toHaveCount(0);
  await page.reload();
  await navigateTo(page, "programs");
  await page
    .getByRole("button", { name: "Start program", exact: false })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Start program & align", exact: false })
    .click();
  await navigateTo(page, "planner");
  await expect(page.locator("[data-calendar-workout]")).toHaveCount(2);
  const saved = (await (await page.request.get("/api/state")).json()).state;
  expect(saved.workouts[0].exercises[0].logs).toEqual(
    state.workouts[0].exercises[0].logs,
  );
  await page
    .getByRole("button", {
      name: "Delete workout: Logged strength",
      exact: true,
    })
    .first()
    .click();
  await expect(page.locator("[data-calendar-workout]")).toHaveCount(1);
});

test("deleting a program clears its calendar and keeps completed workout history", async ({
  page,
  baseURL,
}) => {
  await seed(page, baseURL);
  const { navigateTo } = await import("./navigation.js");
  await navigateTo(page, "programs");
  await page
    .getByRole("button", { name: "View Program", exact: false })
    .click();
  await page.getByRole("button", { name: "Edit program", exact: true }).click();
  page.on("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Delete program", exact: true })
    .click();
  await navigateTo(page, "planner");
  await expect(page.locator("[data-calendar-workout]")).toHaveCount(0);
  await expect(page.locator(".workout-card")).toHaveCount(0);
  await navigateTo(page, "history");
  await expect(page.locator(".history-card")).toContainText("Logged strength");
  await expect(page.locator("#sync-label")).toContainText("Synced");
  await page.reload();
  const saved = (await (await page.request.get("/api/state")).json()).state;
  expect(saved.programs).toHaveLength(0);
  expect(saved.workouts).toHaveLength(1);
  expect(saved.workouts[0].exercises[0].note).toBe("Keep logged note");
});

test("calendar trash supports cancel and deletes a workout permanently", async ({
  page,
  baseURL,
}) => {
  await seed(page, baseURL);
  await expect(
    page.getByRole("button", { name: "Remove from planner", exact: true }),
  ).toHaveCount(0);
  const trash = page.getByRole("button", {
    name: "Delete workout: Second session",
    exact: true,
  });
  page.once("dialog", (d) => d.dismiss());
  await trash.click();
  await expect(trash).toBeVisible();
  await page.getByRole("button", { name: "Month", exact: true }).click();
  page.once("dialog", (d) => d.accept());
  await trash.locator("svg").click();
  await expect(trash).toHaveCount(0);
  await expect(page.locator("#sync-label")).toContainText("Synced");
  await page.reload();
  const saved = (await (await page.request.get("/api/state")).json()).state;
  expect(saved.workouts.map((w) => w.id)).toEqual(["calendar-logged"]);
});
