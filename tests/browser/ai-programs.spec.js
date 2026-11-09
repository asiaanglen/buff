import { test, expect } from "./auth-fixture.js";
import { aiBrief, aiPlan } from "../fixtures/ai-program.js";
import { aiCatalog, normalizeAiDraft } from "../../shared/ai-programs.js";
import { passwordProof, authScheme } from "../../src/credentials.js";
const id = "b".repeat(32);
function draftData(version = 1, name = "AI strength block") {
  const plan = aiPlan(name),
    draft = normalizeAiDraft(plan, aiBrief, aiCatalog({ workouts: [] }));
  return {
    id,
    version,
    brief: aiBrief,
    plan: draft.snapshot,
    startDate: draft.startDate,
    explanation: plan.explanation,
    conversation: [
      { role: "user", text: "Create my program." },
      { role: "assistant", text: plan.explanation },
      ...(version > 1
        ? [
            { role: "user", text: "Make the sessions shorter." },
            { role: "assistant", text: "I shortened the sessions." },
          ]
        : []),
    ],
    savedProgramId: null,
  };
}
const available = {
  enabled: true,
  drafts: [],
};
test("natural conversation, follow-ups, validated preview, chat revisions, failure recovery and explicit save work on mobile", async ({
  page,
}) => {
  let generations = 0,
    savedVersion = null,
    releaseFirst,
    releaseFailure;
  const firstResponse = new Promise((resolve) => {
    releaseFirst = resolve;
  });
  const failedResponse = new Promise((resolve) => {
    releaseFailure = resolve;
  });
  await page.route("**/api/ai-programs**", async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname;
    if (path === "/api/ai-programs") return route.fulfill({ json: available });
    if (path.endsWith("/generate")) {
      const input = request.postDataJSON();
      generations++;
      if (generations === 1) {
        expect(input.message).toBe("I want to build strength");
        expect(input.brief).toBeUndefined();
        expect(input.useHistory).toBe(false);
        await firstResponse;
        return route.fulfill({
          status: 201,
          json: {
            ...draftData(),
            plan: null,
            conversation: [
              { role: "user", text: input.message },
              {
                role: "assistant",
                text: "Let’s get started!\n\n1. **Equipment** — What equipment do you have?\n2. **Schedule** — How often can you train?",
              },
            ],
          },
        });
      }
      if (generations === 2) {
        expect(input.id).toBe(id);
        expect(input.version).toBe(1);
        expect(input.message).toContain("Full gym");
        return route.fulfill({ json: draftData(2) });
      }
      if (generations === 3) {
        expect(input.id).toBe(id);
        expect(input.version).toBe(2);
        expect(input.message).toBe("Make the sessions shorter.");
        return route.fulfill({ json: draftData(3, "Shorter AI block") });
      }
      await failedResponse;
      return route.fulfill({
        status: 422,
        json: {
          error:
            "Claude could not update this draft. Your previous draft is unchanged.",
        },
      });
    }
    if (path.endsWith("/save")) {
      savedVersion = request.postDataJSON().version;
      return route.fulfill({ status: 201, json: { programId: "saved-test" } });
    }
    return route.fulfill({ json: draftData(2, "Shorter AI block") });
  });
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/");
  await page.locator("#mobile-page-select").selectOption("home");
  await page
    .getByRole("link", { name: "Create a program with AI", exact: false })
    .click();
  const ui = page.locator(".ai-coach-host");
  await expect(page.getByRole("dialog", { name: "Buffy" })).toBeVisible();
  await expect(ui.getByLabel("Message Buffy", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".ai-program-popup iframe")).toHaveCount(0);
  await ui
    .getByLabel("Message Buffy", { exact: true })
    .fill("Keep this unsent question");
  await page.getByRole("button", { name: "Close Buffy chat" }).click();
  await expect(page.locator(".ai-program-popup")).toBeHidden();
  await page
    .getByRole("link", { name: "Create a program with AI", exact: false })
    .click();
  await expect(ui.getByLabel("Message Buffy", { exact: true })).toBeVisible();
  await expect(ui.getByLabel("Message Buffy", { exact: true })).toHaveValue(
    "Keep this unsent question",
  );
  await expect(ui.locator("#ai-brief")).toHaveCount(0);
  await ui
    .getByLabel("Message Buffy", { exact: true })
    .fill("I want to build strength");
  await ui.getByRole("button", { name: "Send message", exact: true }).click();
  try {
    await expect(ui.getByLabel("Message Buffy", { exact: true })).toHaveValue(
      "",
    );
    await expect(ui.locator(".ai-message-user").last()).toHaveText(
      "YouI want to build strength",
    );
    await expect(
      ui.getByRole("button", { name: "Thinking…", exact: true }),
    ).toBeDisabled();
  } finally {
    releaseFirst();
  }

  await expect(ui.locator(".ai-message-content ol li")).toHaveCount(2);
  await expect(ui.locator(".ai-message-content li strong")).toHaveText([
    "Equipment",
    "Schedule",
  ]);
  await expect(ui.locator(".ai-message-content")).not.toContainText("**");
  await expect(
    ui.getByRole("button", { name: "Save program", exact: true }),
  ).toHaveCount(0);
  await ui
    .getByLabel("Message Buffy", { exact: true })
    .fill("Full gym, beginner, 3 days per week, 45 minutes, for 2 weeks.");
  await ui.getByRole("button", { name: "Send message", exact: true }).click();
  await ui.locator(".ai-plan-attachment > summary").click();
  await expect(
    ui.getByRole("heading", { name: "AI strength block", exact: true }),
  ).toBeVisible();
  await expect(ui.locator(".ai-week")).toHaveCount(2);
  await expect(ui.locator(".ai-preview")).toContainText("Back Squat");
  await expect(ui.locator(".ai-preview")).toContainText(
    "Starting weight unassigned",
  );
  expect(savedVersion).toBeNull();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await ui
    .getByLabel("What would you like to change?", { exact: true })
    .fill("Make the sessions shorter.");
  await ui.getByRole("button", { name: "Send message", exact: true }).click();
  await ui.locator(".ai-plan-attachment > summary").click();
  await expect(
    ui.getByRole("heading", { name: "Shorter AI block", exact: true }),
  ).toBeVisible();
  await ui
    .getByLabel("What would you like to change?", { exact: true })
    .fill("One more revision");
  await ui.getByRole("button", { name: "Send message", exact: true }).click();
  try {
    await expect(
      ui.getByLabel("What would you like to change?", { exact: true }),
    ).toHaveValue("");
    await expect(ui.locator(".ai-message-user").last()).toContainText(
      "One more revision",
    );
  } finally {
    releaseFailure();
  }

  await expect(ui.getByRole("alert")).toContainText(
    "previous draft is unchanged",
  );
  await expect(
    ui.getByLabel("What would you like to change?", { exact: true }),
  ).toHaveValue("One more revision");
  await ui.locator(".ai-plan-attachment > summary").click();
  await expect(
    ui.getByRole("heading", { name: "Shorter AI block", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "/tmp/buff-ai-program-mobile.png",
    fullPage: true,
  });
  await ui.getByRole("button", { name: "Save program", exact: true }).click();
  await expect(ui.locator(".ai-chat-saved")).toBeVisible();
  await ui.getByRole("button", { name: "View program", exact: true }).click();
  await expect(page.locator(".ai-program-popup")).toBeHidden();
  await expect(page.locator("#mobile-page-select")).toHaveValue("programs");
  await expect(page).toHaveURL(/\/$/);
  expect(savedVersion).toBe(3);
});
test("actual Worker enforces authentication and configuration and saves an owned draft exactly once", async ({
  page,
  browser,
  baseURL,
}) => {
  const anonymous = await browser.newContext({ baseURL });
  expect((await anonymous.request.get("/api/ai-programs")).status()).toBe(401);
  await anonymous.close();
  expect(
    (await page.request.get("/api/ai-programs/" + "a".repeat(32))).status(),
  ).toBe(404);
  const generated = await page.request.post("/api/ai-programs/generate", {
    headers: { Origin: baseURL },
    data: { brief: aiBrief },
  });
  expect(generated.status()).toBe(503);
  await page.goto("/create-with-ai");
  await expect(
    page.getByRole("dialog", { name: "Buffy", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Send message", exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole("status")).toContainText("not enabled yet");
  const owner = await browser.newContext({
    baseURL,
    extraHTTPHeaders: { "CF-Connecting-IP": "198.18.249.55" },
  });
  try {
    const email = "usage-owner@example.test";
    expect(
      (
        await owner.request.post("/api/auth/signin", {
          headers: { Origin: baseURL },
          data: {
            email,
            password: await passwordProof(
              email,
              "usage-owner-only-test-password",
            ),
            credentialVersion: authScheme,
          },
        })
      ).ok(),
    ).toBeTruthy();
    const before = await (await owner.request.get("/api/state")).json();
    const screen = await owner.newPage();
    await screen.goto("/coach?tab=programs");
    await screen
      .getByRole("button", { name: "Create coach profile", exact: false })
      .click();
    await screen.getByRole("button", { name: "Programs", exact: true }).click();
    await screen
      .getByRole("link", { name: "Create with AI", exact: false })
      .click();
    const coachChat = screen.locator(".ai-coach-host");
    await coachChat
      .getByText("Previous conversations", { exact: true })
      .click();
    await coachChat
      .getByRole("button", {
        name: "Seeded AI program · Resume draft",
        exact: true,
      })
      .click();
    await coachChat.locator(".ai-plan-attachment > summary").click();
    await coachChat
      .getByRole("button", { name: "Save program", exact: true })
      .click();
    await expect(coachChat.locator(".ai-chat-saved")).toBeVisible();
    await coachChat
      .getByRole("button", { name: "View program", exact: true })
      .click();
    await expect(screen.locator(".ai-program-popup")).toBeHidden();
    await expect(
      screen.getByRole("heading", { name: "Seeded AI program", exact: true }),
    ).toBeVisible();
    const persisted = await (await owner.request.get("/api/state")).json();
    const programId = persisted.state.programs.find(
      (p) => p.name === "Seeded AI program",
    ).id;
    const second = await owner.request.post(
      "/api/ai-programs/" + "a".repeat(32) + "/save",
      { headers: { Origin: baseURL }, data: { version: 1 } },
    );
    expect(second.status()).toBe(200);
    expect((await second.json()).programId).toBe(programId);
    const after = await (await owner.request.get("/api/state")).json();
    expect(after.state.activeProgramId).toBe(before.state?.activeProgramId);
    const plan = after.state.programs.find((p) => p.id === programId);
    expect(plan.unenrolled).toBe(true);
    expect(
      after.state.workouts.filter((w) => w.programId === programId),
    ).toHaveLength(6);
    await expect(
      screen.getByRole("link", { name: "Create with AI", exact: false }),
    ).toHaveAttribute("href", "/create-with-ai?coach=1");
    await expect(
      screen.getByRole("heading", { name: "Seeded AI program", exact: true }),
    ).toBeVisible();
    await screen
      .getByRole("link", { name: "Create with AI", exact: false })
      .click();
    await expect(screen).toHaveURL(/\/coach\?tab=programs$/);

    await expect(coachChat.locator(".ai-chat-saved")).toBeVisible();
    screen.once("dialog", (d) => d.accept());
    await coachChat
      .getByRole("button", { name: "New conversation", exact: true })
      .click();
    await expect(
      coachChat.getByLabel("Message Buffy", { exact: true }),
    ).toBeVisible();
    await screen.getByRole("button", { name: "Close Buffy chat" }).click();
    await expect(screen.locator(".ai-program-popup")).toBeHidden();
    await expect(
      screen.getByRole("link", { name: "Create with AI", exact: false }),
    ).toBeFocused();
    await screen
      .getByRole("link", { name: "Create with AI", exact: false })
      .click();
    await coachChat.getByLabel("Message Buffy", { exact: true }).focus();
    await coachChat
      .getByLabel("Message Buffy", { exact: true })
      .press("Escape");
    await expect(screen.locator(".ai-program-popup")).toBeHidden();
  } finally {
    await owner.close();
  }
});

test("minimized chatbot keeps unsent messages and clears private state on signout", async ({
  page,
}) => {
  await page.route("**/api/ai-programs", (route) =>
    route.fulfill({ json: available }),
  );
  await page.goto("/?tab=programs");
  await page
    .getByRole("link", { name: "Create with AI", exact: false })
    .click();
  const input = page
    .locator(".ai-coach-host")
    .getByLabel("Message Buffy", { exact: true });
  await input.fill("My private unsent training question");
  await page.getByRole("button", { name: "Close Buffy chat" }).click();
  await page
    .getByRole("button", { name: "Chat with Buffy", exact: true })
    .click();
  await expect(input).toHaveValue("My private unsent training question");
  await page.getByRole("button", { name: "Close Buffy chat" }).click();
  await page
    .getByRole("button", { name: "Account and cross-device sync", exact: true })
    .click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.locator(".ai-program-popup")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Chat with Buffy", exact: true }),
  ).toBeHidden();
  await expect(page.locator("body")).not.toContainText(
    "My private unsent training question",
  );
});
