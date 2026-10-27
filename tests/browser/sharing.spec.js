import { test, expect } from "./auth-fixture.js";
import { exercise, daysApart } from "../../src/model.js";
import { navigateTo } from "./navigation.js";
import { passwordProof, authScheme } from "../../src/credentials.js";
async function seed(page, baseURL) {
  const program = {
    id: "friend-program",
    name: "Get stronger together",
    weeks: 4,
    startDate: "2026-10-26",
    note: "Build consistency",
  };
  const entry = exercise("Back Squat", 2, 5, "reps", 95, "A");
  entry.logs[0] = { weight: "175", actual: "3", done: true };
  entry.note = "PRIVATE SESSION NOTE";
  const workouts = ["2026-10-26", "2026-10-28", "2026-11-02"].map(
    (date, i) => ({
      id: "friend-workout-" + i,
      name: "Strength day " + (i + 1),
      programId: program.id,
      date,
      note: "Control the movement",
      exercises: [structuredClone(entry)],
    }),
  );
  expect(
    (
      await page.request.put("/api/state", {
        headers: { Origin: baseURL },
        data: {
          state: { version: 1, unit: "lbs", programs: [program], workouts },
          revision: 0,
        },
      })
    ).ok(),
  ).toBeTruthy();
  return program;
}
async function signedContext(browser, baseURL) {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 390, height: 844 },
    extraHTTPHeaders: {
      "CF-Connecting-IP": `198.19.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250) + 1}`,
    },
  });
  const email = `friend-${crypto.randomUUID()}@example.com`;
  const signup = await context.request.post("/api/auth/signup", {
    headers: { Origin: baseURL },
    data: {
      email,
      password: await passwordProof(email, "x"),
      credentialVersion: authScheme,
    },
  });
  expect(signup.ok()).toBeTruthy();
  return context;
}
test("a phone invitation carries the requested message and adds the program after the friend signs up", async ({
  page,
  baseURL,
  browser,
}) => {
  await seed(page, baseURL);
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (payload) => {
        window.lastShare = payload;
      },
    }),
  );
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1",
    }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await navigateTo(page, "programs");
  await page
    .getByRole("button", { name: "Share program", exact: false })
    .click();
  await expect(page.locator(".share-result")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Choose contact in Messages", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Your name", { exact: true })).toHaveCount(0);
  await expect(
    page.getByText("Customize your name in the invitation", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("status").filter({ hasText: "Invitation ready." }),
  ).toBeVisible();
  await page
    .locator("#program-share-dialog")
    .screenshot({ path: "/tmp/buff-share-program-mobile.png" });
  const message = await page
    .getByLabel("Invitation message", { exact: true })
    .inputValue();
  expect(message).toMatch(
    /^Wanna get buff with me\? Try out this new workout program!\n/,
  );
  const url = message.split("\n").at(-1),
    token = new URL(url).searchParams.get("invite");
  expect(token).toMatch(/^[a-f0-9]{64}$/);
  const sms = await page
    .getByRole("link", { name: "Choose contact in Messages", exact: true })
    .getAttribute("href");
  expect(sms).toMatch(/^sms:&body=/);
  expect(decodeURIComponent(sms.split("body=")[1])).toBe(message);
  await page.getByRole("button", { name: "Share…", exact: true }).click();
  expect((await page.evaluate(() => window.lastShare)).text).toBe(message);
  const friend = await browser.newContext({
    baseURL,
    viewport: { width: 390, height: 844 },
    extraHTTPHeaders: { "CF-Connecting-IP": "198.19.252.1" },
  });
  const guest = await friend.newPage();
  await guest.route("**/api/auth/providers", (route) =>
    route.fulfill({ json: { google: true, googleLinked: false } }),
  );
  await guest.goto(url);
  await expect(
    guest.getByRole("region", { name: "Workout program invitation" }),
  ).toContainText("Your friend invited you to get buff!");
  await expect(guest.locator(".sidebar")).toHaveCount(0);
  await guest.screenshot({
    path: "/tmp/buff-program-invitation-mobile.png",
    fullPage: false,
  });
  await guest
    .getByRole("button", { name: "Sign up & get program", exact: true })
    .click();
  await expect(
    guest.getByRole("link", { name: "Continue with Google", exact: true }),
  ).toHaveAttribute(
    "href",
    "/api/auth/google/start?return_to=" +
      encodeURIComponent("/?invite=" + token),
  );
  await guest
    .getByLabel("Email", { exact: true })
    .fill(`new-friend-${crypto.randomUUID()}@example.com`);
  await guest.getByLabel(/^Password/).fill("x");
  await guest
    .getByRole("button", { name: "Create account →", exact: true })
    .click();
  await expect(
    guest.getByRole("heading", { name: "Get stronger together", exact: true }),
  ).toBeVisible();
  await expect(
    guest.getByRole("combobox", { name: "Go to page", exact: true }),
  ).toHaveValue("programs");
  await expect(guest.locator("#account-root")).toBeEmpty();
  const saved = await (await friend.request.get("/api/state")).json();
  expect(saved.state.programs).toHaveLength(1);
  const copy = saved.state.programs[0];
  expect(copy.id).not.toBe("friend-program");
  const copied = saved.state.workouts.filter(
    (workout) => workout.programId === copy.id,
  );
  expect(copied).toHaveLength(3);
  expect(
    copied.map((workout) => daysApart(copy.startDate, workout.date)),
  ).toEqual([0, 2, 7]);
  expect(
    copied[0].exercises[0].logs.every(
      (log) => !log.done && log.weight === "" && log.actual === "",
    ),
  ).toBe(true);
  expect(copied[0].exercises[0].note).toBeUndefined();
  expect(copied[0].exercises[0].libraryId).toBe("back-squat");
  await guest.goto(url);
  await expect(
    guest.getByRole("heading", { name: "Get stronger together", exact: true }),
  ).toBeVisible();
  expect(
    (await (await friend.request.get("/api/state")).json()).state.programs,
  ).toHaveLength(1);
  await friend.close();
});
test("invitations expose only metadata, require sign-in, import idempotently and can only be disabled by their owner", async ({
  page,
  baseURL,
  browser,
}) => {
  const program = await seed(page, baseURL);
  const create = await page.request.post("/api/program-shares", {
    headers: { Origin: baseURL },
    data: { programId: program.id, inviterName: "Alex" },
  });
  expect(create.status()).toBe(201);
  const { token, url } = await create.json();
  const self = await page.request.post(
    "/api/program-shares/" + token + "/accept",
    { headers: { Origin: baseURL }, data: { startDate: "2026-11-02" } },
  );
  expect((await self.json()).programId).toBe(program.id);
  expect(
    (
      await page.request.post("/api/program-shares", {
        headers: { Origin: baseURL },
        data: null,
      })
    ).status(),
  ).toBe(400);
  const anonymous = await browser.newContext({ baseURL });
  const info = await (
    await anonymous.request.get("/api/program-shares/" + token)
  ).json();
  expect(Object.keys(info).sort()).toEqual(
    ["inviterName", "programName", "weeks", "workoutCount"].sort(),
  );
  expect(JSON.stringify(info)).not.toContain("PRIVATE");
  expect(
    (
      await anonymous.request.post("/api/program-shares/" + token + "/accept", {
        headers: { Origin: baseURL },
        data: { startDate: "2026-11-02" },
      })
    ).status(),
  ).toBe(401);
  const recipient = await signedContext(browser, baseURL);
  expect(
    (
      await recipient.request.delete("/api/program-shares/" + token, {
        headers: { Origin: baseURL },
      })
    ).status(),
  ).toBe(404);
  expect(
    (
      await recipient.request.post("/api/program-shares", {
        headers: { Origin: baseURL },
        data: { programId: program.id, inviterName: "Other" },
      })
    ).status(),
  ).toBe(404);
  expect(
    (
      await recipient.request.post("/api/program-shares/" + token + "/accept", {
        headers: { Origin: "https://other.test" },
        data: { startDate: "2026-11-02" },
      })
    ).status(),
  ).toBe(403);
  const [one, two] = await Promise.all(
    [1, 2].map(() =>
      recipient.request.post("/api/program-shares/" + token + "/accept", {
        headers: { Origin: baseURL },
        data: { startDate: "2026-11-02" },
      }),
    ),
  );
  expect(one.ok()).toBeTruthy();
  expect(two.ok()).toBeTruthy();
  expect((await one.json()).programId).toBe((await two.json()).programId);
  const state = (await (await recipient.request.get("/api/state")).json())
    .state;
  expect(state.programs).toHaveLength(1);
  expect(state.workouts).toHaveLength(3);
  const sender = (await (await page.request.get("/api/state")).json()).state;
  expect(sender.workouts[0].exercises[0].note).toBe("PRIVATE SESSION NOTE");
  expect(sender.workouts[0].exercises[0].logs[0].weight).toBe("175");
  expect(
    (
      await page.request.delete("/api/program-shares/" + token, {
        headers: { Origin: baseURL },
      })
    ).ok(),
  ).toBeTruthy();
  expect(
    (await anonymous.request.get("/api/program-shares/" + token)).status(),
  ).toBe(404);
  const recipientPage = await recipient.newPage();
  await recipientPage.goto(url);
  await expect(
    recipientPage.getByRole("region", { name: "Workout program invitation" }),
  ).toContainText("no longer available");
  expect(
    (await (await recipient.request.get("/api/state")).json()).state.programs,
  ).toHaveLength(1);
  await recipientPage
    .getByRole("button", { name: "Dismiss invitation", exact: true })
    .click();
  await expect(
    recipientPage.getByRole("region", { name: "Workout program invitation" }),
  ).toHaveCount(0);
  await anonymous.close();
  await recipient.close();
});

test("an existing signed-in friend gets a separate copy without replacing their programs or history", async ({
  page,
  baseURL,
  browser,
}) => {
  const program = await seed(page, baseURL);
  const share = await (
    await page.request.post("/api/program-shares", {
      headers: { Origin: baseURL },
      data: { programId: program.id, inviterName: "Alex" },
    })
  ).json();
  const recipient = await signedContext(browser, baseURL);
  const entry = exercise("Pull-up", 1, 6, "reps", 0);
  entry.logs[0] = { weight: "0", actual: "6", done: true };
  entry.note = "MY EXISTING HISTORY";
  const existingProgram = {
    id: "existing-program",
    name: "My existing program",
    weeks: 2,
    startDate: "2026-11-02",
    note: "",
  };
  const existingWorkout = {
    id: "existing-workout",
    programId: existingProgram.id,
    date: "2026-11-02",
    name: "My pull-ups",
    note: "Keep this",
    exercises: [entry],
  };
  expect(
    (
      await recipient.request.put("/api/state", {
        headers: { Origin: baseURL },
        data: {
          state: {
            version: 1,
            unit: "lbs",
            activeProgramId: existingProgram.id,
            programs: [existingProgram],
            workouts: [existingWorkout],
          },
          revision: 0,
        },
      })
    ).ok(),
  ).toBeTruthy();
  const friend = await recipient.newPage();
  await friend.goto(share.url);
  await expect(
    friend.getByRole("heading", { name: program.name, exact: true }),
  ).toBeVisible();
  const saved = (await (await recipient.request.get("/api/state")).json())
    .state;
  expect(saved.programs).toHaveLength(2);
  expect(saved.activeProgramId).toBe(existingProgram.id);
  expect(
    saved.workouts.find((workout) => workout.id === existingWorkout.id),
  ).toEqual(existingWorkout);
  await recipient.close();
});
