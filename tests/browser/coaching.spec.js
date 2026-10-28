import { test, expect } from "@playwright/test";
import { fillSignupProfile } from "../signup-profile.js";
import { passwordProof, authScheme } from "../../src/credentials.js";
import { exercise } from "../../src/model.js";
const date = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
async function profile(page, email, first, last) {
  await fillSignupProfile(page);
  await page.getByLabel("First Name", { exact: true }).fill(first);
  await page.getByLabel("Last Name", { exact: true }).fill(last);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("coach test password");
  await page
    .getByRole("button", { name: "Create account →", exact: true })
    .click();
}
async function context(browser) {
  return browser.newContext({
    viewport: { width: 390, height: 844 },
    extraHTTPHeaders: {
      "CF-Connecting-IP": `198.18.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250) + 1}`,
    },
  });
}
test("coach builds a program, invites by email/text, client joins, coach logs results, and client can revoke access", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(90000);
  const a = await context(browser),
    b = await context(browser);
  const coach = await a.newPage(),
    client = await b.newPage();
  const email = `coach-${crypto.randomUUID()}@example.test`,
    clientEmail = `client-${crypto.randomUUID()}@example.test`;
  try {
    await coach.goto(baseURL + "/coach");
    await expect(coach).toHaveURL(/\/coach$/);
    await coach
      .getByRole("button", { name: "Create a coach account", exact: true })
      .click();
    await expect(
      coach.getByRole("heading", { name: "Create your coach account" }),
    ).toBeVisible();
    await profile(coach, email, "Casey", "Coach");
    await expect(
      coach.getByRole("heading", { name: "Welcome, Casey." }),
    ).toBeVisible();
    await coach
      .getByRole("button", { name: "My programs", exact: true })
      .click();
    await coach
      .getByRole("link", { name: "Build or edit programs", exact: false })
      .click();
    await expect(
      coach.getByRole("link", { name: "Coach dashboard", exact: false }),
    ).toBeVisible();
    await coach
      .getByRole("button", { name: "Create program", exact: false })
      .first()
      .click();
    await coach
      .getByLabel("Program name", { exact: true })
      .fill("Coach strength block");
    await coach.getByLabel("Number of weeks").fill("2");
    await coach.getByLabel("Start date", { exact: true }).fill(date());
    await coach
      .getByRole("button", { name: "Create program →", exact: true })
      .click();
    await coach
      .getByRole("button", { name: "Plan a workout", exact: false })
      .first()
      .click();
    await coach.getByLabel("Search exercise library").fill("back squat");
    await coach
      .getByRole("button", {
        name: "Back Squat Legs · Barbell · Reps",
        exact: true,
      })
      .click();
    await coach.getByLabel("Search exercise library").fill("plank");
    await coach
      .getByRole("button", {
        name: "Plank Core · Bodyweight · Timed",
        exact: true,
      })
      .click();
    await coach
      .getByRole("button", { name: "Create workout", exact: false })
      .click();
    await expect(coach.locator("#sync-label")).toContainText("Synced");
    await coach
      .getByRole("link", { name: "Coach dashboard", exact: false })
      .click();
    await coach
      .getByRole("button", { name: "My programs", exact: true })
      .click();
    await coach
      .getByRole("button", { name: "Invite a client", exact: false })
      .click();
    const share = coach.locator("#coach-invite-dialog");
    await expect(share.locator("input[type=email]")).toHaveCount(0);
    await share
      .getByRole("button", { name: "Create invitation", exact: true })
      .click();
    await expect(
      share.getByRole("link", { name: "Share by email", exact: true }),
    ).toHaveCount(0);
    await expect(
      share.getByText("To invite by email, copy the invitation above", {
        exact: false,
      }),
    ).toBeVisible();
    await coach
      .context()
      .grantPermissions(["clipboard-read", "clipboard-write"]);
    await share
      .getByRole("button", { name: "Copy invitation", exact: true })
      .click();
    await expect(share.getByRole("status")).toHaveText(
      "Invitation copied. Paste it into an email to your client.",
    );
    expect(await coach.evaluate(() => navigator.clipboard.readText())).toBe(
      await share
        .getByLabel("Invitation message", { exact: true })
        .inputValue(),
    );
    await expect(
      share.getByRole("link", { name: "Share by text", exact: true }),
    ).toHaveAttribute("href", /^sms:/);
    const message = await share
      .getByLabel("Invitation message", { exact: true })
      .inputValue();
    const inviteUrl = message.match(/https?:\/\/[^\s]+#invite=[a-f0-9]{64}/)[0];
    await share
      .getByRole("button", { name: "Close invitation", exact: true })
      .click();
    // A returning client may choose Create account from their invitation.
    const existing = await client.request.post(baseURL + "/api/auth/signup", {
      headers: { Origin: baseURL },
      data: {
        firstName: "Alex",
        lastName: "Client",
        dateOfBirth: "1990-01-01",
        email: clientEmail,
        password: await passwordProof(clientEmail, "coach test password"),
        credentialVersion: authScheme,
      },
    });
    expect(existing.ok()).toBeTruthy();
    await b.clearCookies();
    await client.goto(inviteUrl);
    await expect(
      client.getByRole("heading", {
        name: "Casey Coach invited you to train.",
      }),
    ).toBeVisible();
    await expect(client.getByLabel("Week 1 start date")).toBeVisible();
    await client.getByRole("checkbox").check();
    await client
      .getByRole("button", { name: "Create account & join", exact: true })
      .click();
    await profile(client, clientEmail, "Alex", "Client");
    await expect(
      client.getByRole("heading", { name: "Sign in to Buff", exact: true }),
    ).toBeVisible();
    await expect(client.getByLabel("Email", { exact: true })).toHaveValue(
      clientEmail,
    );
    await expect(client.locator(".account-message")).toContainText(
      "invitation",
    );
    await expect(client.getByLabel("Password", { exact: true })).toHaveValue(
      "",
    );
    await client
      .getByLabel("Password", { exact: true })
      .fill("coach test password");
    await client
      .getByRole("button", { name: "Sign in →", exact: true })
      .click();
    await expect(client).toHaveURL(/tab=programs/);
    await expect(client.locator(".program-card")).toContainText(
      "Coach strength block",
    );
    await coach
      .getByRole("button", { name: "Clients’ programs", exact: true })
      .click();
    await coach
      .getByRole("button", { name: "Refresh progress", exact: true })
      .click();
    await expect(
      coach.getByRole("heading", { name: "Alex Client", exact: true }),
    ).toBeVisible();
    await coach
      .getByRole("button", {
        name: "View progress & log workouts",
        exact: false,
      })
      .click();
    await coach.locator(".coach-workout summary").first().click();
    await coach
      .getByRole("button", { name: "Move / edit workout", exact: true })
      .click();
    const editor = coach.locator(".coach-plan-dialog");
    await coach.setViewportSize({ width: 320, height: 844 });
    expect(
      await editor.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBe(true);
    const oldDate = await editor
      .getByLabel("Workout date", { exact: true })
      .inputValue();
    const movedDate = new Date(oldDate + "T12:00:00Z");
    movedDate.setUTCDate(movedDate.getUTCDate() + 1);
    const newDate = movedDate.toISOString().slice(0, 10);
    await editor.getByLabel("Workout date", { exact: true }).fill(newDate);
    const squat = editor.locator("fieldset").first();
    await squat
      .getByRole("button", { name: "Swap exercise", exact: true })
      .click();
    await squat
      .getByLabel("Search exercise library", { exact: true })
      .fill("Front Squat");
    await squat
      .getByLabel("Search exercise library", { exact: true })
      .press("Tab");
    await squat.getByLabel("Target per set", { exact: true }).fill("6");
    await squat.getByLabel("Superset group", { exact: true }).fill("A");
    await editor
      .getByRole("button", { name: "Save client workout", exact: true })
      .click();
    await expect(editor).toHaveCount(0);
    await expect(coach.getByRole("status")).toContainText(
      "Workout plan updated",
    );
    const clientState = await (
      await client.request.get(baseURL + "/api/state")
    ).json();
    const assigned = clientState.state.workouts.find((w) =>
      w.exercises.some((e) => e.name === "Front Squat"),
    );
    expect(assigned.date).toBe(newDate);
    expect(assigned.exercises[0].target).toBe(6);
    expect(assigned.exercises[0].group).toBe("A");
    // Swap back before the existing results/history checks.
    await coach
      .getByRole("button", { name: "Move / edit workout", exact: true })
      .click();
    await editor
      .locator("fieldset")
      .first()
      .getByRole("button", { name: "Swap exercise", exact: true })
      .click();
    await editor
      .locator("fieldset")
      .first()
      .getByLabel("Search exercise library", { exact: true })
      .fill("Back Squat");
    await editor
      .locator("fieldset")
      .first()
      .getByLabel("Search exercise library", { exact: true })
      .press("Tab");
    await editor
      .getByRole("button", { name: "Save client workout", exact: true })
      .click();
    await expect(editor).toHaveCount(0);
    await coach
      .getByLabel("Back Squat set 1 weight", { exact: true })
      .fill("135");
    await coach.getByLabel("Back Squat set 1 reps", { exact: true }).fill("8");
    await coach
      .getByLabel("Back Squat set 1 completed", { exact: true })
      .check();
    await coach
      .getByLabel("Notes for Back Squat", { exact: true })
      .fill("CLIENT_PRIVATE_COACHED_NOTE");
    await coach.getByLabel("Plank set 1 seconds", { exact: true }).fill("60");
    await coach.getByLabel("Plank set 1 completed", { exact: true }).check();
    await coach
      .getByRole("button", { name: "Save workout progress", exact: true })
      .click();
    await expect(coach.getByRole("status")).toContainText(
      "Workout progress saved",
    );
    expect(
      await coach.evaluate(() =>
        Object.values(localStorage).some((v) =>
          v.includes("CLIENT_PRIVATE_COACHED_NOTE"),
        ),
      ),
    ).toBe(false);
    await coach.setViewportSize({ width: 320, height: 844 });
    expect(
      await coach.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await coach.screenshot({
      path: "/tmp/buff-coach-log-mobile.png",
      fullPage: true,
    });
    coach.once("dialog", (dialog) => dialog.accept());
    await coach
      .getByRole("button", { name: "Mark workout complete", exact: true })
      .click();
    await expect(coach.getByRole("status")).toContainText(
      "Workout progress saved",
    );
    await client.reload();
    const { navigateTo } = await import("./navigation.js");
    await navigateTo(client, "history");
    await expect(client.locator(".history-card")).toContainText(
      "Back Squat + Plank",
    );
    await client
      .getByRole("button", { name: "View log", exact: false })
      .first()
      .click();
    await expect(
      client.getByLabel("Back Squat set 1 weight", { exact: true }),
    ).toHaveValue("135");
    await expect(
      client.getByLabel("Back Squat set 1 reps", { exact: true }),
    ).toHaveValue("8");
    const saved = (
      await (await client.request.get(baseURL + "/api/state")).json()
    ).state;
    const workout = saved.workouts.find(
      (w) =>
        w.programId ===
        saved.programs.find((p) => p.name === "Coach strength block").id,
    );
    expect(workout.exercises[1].logs[0].actual).toBe("60");
    expect(workout.exercises[0].note).toBe("CLIENT_PRIVATE_COACHED_NOTE");
    await client
      .getByRole("button", {
        name: "Account and cross-device sync",
        exact: true,
      })
      .click();
    await client
      .getByRole("link", { name: "Manage coaching access", exact: false })
      .click();
    client.once("dialog", (dialog) => dialog.accept());
    await client
      .getByRole("button", { name: "End coach access", exact: true })
      .click();
    await expect(
      client.getByText("Access ended", { exact: true }),
    ).toBeVisible();
    await coach
      .getByRole("button", { name: "Refresh client progress", exact: true })
      .click();
    await expect(coach.getByRole("alert")).toContainText(
      "Active client program not found",
    );
    await expect(coach.locator(".coach-log")).toHaveCount(0);
    const after = (
      await (await client.request.get(baseURL + "/api/state")).json()
    ).state;
    expect(after.workouts).toEqual(saved.workouts);
    await coach.setViewportSize({ width: 320, height: 844 });
    expect(
      await coach.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await coach.screenshot({
      path: "/tmp/buff-coach-mobile.png",
      fullPage: true,
    });
  } catch (e) {
    console.log("Coach flow failed:", e.message);
    throw e;
  } finally {
    await Promise.allSettled([a.close(), b.close()]);
  }
});
test("actual D1 prevents two different clients from claiming the same invitation and rejects stale coach writes", async ({
  browser,
  baseURL,
}) => {
  const sessions = [];
  async function account(name) {
    const c = await context(browser);
    sessions.push(c);
    const p = await c.newPage(),
      email = `${name}-${crypto.randomUUID()}@example.test`;
    const r = await p.request.post(baseURL + "/api/auth/signup", {
      headers: { Origin: baseURL },
      data: {
        firstName: name,
        lastName: "Test",
        dateOfBirth: "1990-01-01",
        email,
        password: await passwordProof(email, "test password"),
        credentialVersion: authScheme,
      },
    });
    expect(r.ok()).toBeTruthy();
    return p;
  }
  try {
    const coach = await account("Coach"),
      a = await account("First"),
      b = await account("Second"),
      other = await account("Other");
    const h = { Origin: baseURL };
    await coach.request.post(baseURL + "/api/coaching/profile", {
      headers: h,
      data: {},
    });
    await other.request.post(baseURL + "/api/coaching/profile", {
      headers: h,
      data: {},
    });
    expect(
      (
        await coach.request.put(baseURL + "/api/state", {
          headers: h,
          data: {
            revision: 0,
            state: {
              version: 1,
              unit: "lbs",
              programs: [
                {
                  id: "source",
                  name: "Race program",
                  weeks: 2,
                  startDate: date(),
                  note: "",
                },
              ],
              workouts: [
                {
                  id: "source-workout",
                  programId: "source",
                  date: date(),
                  name: "Assigned strength",
                  note: "",
                  exercises: [exercise("Back Squat", 1, 5, "reps", 95)],
                },
              ],
            },
          },
        })
      ).ok(),
    ).toBeTruthy();
    const share = await (
      await coach.request.post(baseURL + "/api/coaching/invites", {
        headers: h,
        data: { programId: "source" },
      })
    ).json();
    const token = share.url.split("#invite=")[1];
    const endpoint = baseURL + "/api/coaching/invites/" + token + "/accept";
    const results = await Promise.all(
      [a, b].map((p) =>
        p.request.post(endpoint, {
          headers: h,
          data: { allowCoachLogging: true, startDate: date() },
        }),
      ),
    );
    expect(results.map((r) => r.status()).sort()).toEqual([201, 409]);
    const winner = results[0].status() === 201 ? a : b;
    const payload =
      results[0].status() === 201
        ? await results[0].json()
        : await results[1].json();
    const detail = await (
      await coach.request.get(
        baseURL + "/api/coaching/assignments/" + payload.assignmentId,
      )
    ).json();
    expect(
      (
        await other.request.get(
          baseURL + "/api/coaching/assignments/" + payload.assignmentId,
        )
      ).status(),
    ).toBe(404);
    const state = await (
      await winner.request.get(baseURL + "/api/state")
    ).json();
    expect(
      (
        await winner.request.put(baseURL + "/api/state", {
          headers: h,
          data: { state: state.state, revision: state.revision },
        })
      ).ok(),
    ).toBeTruthy();
    const response = await coach.request.patch(
      baseURL +
        "/api/coaching/assignments/" +
        payload.assignmentId +
        "/workouts/" +
        detail.workouts[0].id,
      {
        headers: h,
        data: { revision: detail.revision, exercises: [], complete: true },
      },
    );
    expect(response.status()).toBe(409);
    expect(
      (
        await coach.request.get(
          baseURL + "/api/coaching/assignments/" + payload.assignmentId,
        )
      ).headers()["cache-control"],
    ).toBe("no-store");
  } finally {
    for (const c of sessions) await c.close();
  }
});
