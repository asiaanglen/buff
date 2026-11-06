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
test("short form, validated preview, chat revisions, failure recovery and explicit save work on mobile", async ({
  page,
}) => {
  let generations = 0,
    savedVersion = null;
  await page.route("**/api/ai-programs**", async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname;
    if (path === "/api/ai-programs") return route.fulfill({ json: available });
    if (path.endsWith("/generate")) {
      const input = request.postDataJSON();
      generations++;
      if (generations === 1) {
        expect(input.brief.goal).toBe("Lose weight");
        expect(input.brief.weeks).toBe(2);
        expect(input.brief.useHistory).toBe(false);
        return route.fulfill({ status: 201, json: draftData() });
      }
      if (generations === 2) {
        expect(input.id).toBe(id);
        expect(input.version).toBe(1);
        expect(input.message).toBe("Make the sessions shorter.");
        return route.fulfill({ json: draftData(2, "Shorter AI block") });
      }
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
  await page.goto("/?tab=programs");
  await page
    .getByRole("link", { name: "Create with AI", exact: false })
    .click();
  await expect(
    page.getByRole("heading", { name: "Create with AI", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Your goal", exact: true })
    .selectOption("Lose weight");
  await page.getByLabel("Program length (weeks)", { exact: true }).fill("2");
  await page
    .getByLabel("Week 1 start date", { exact: true })
    .fill(aiBrief.startDate);
  await page
    .getByRole("button", { name: "Build my program", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "AI strength block", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".ai-week")).toHaveCount(2);
  await expect(page.locator(".ai-preview")).toContainText("Back Squat");
  await expect(page.locator(".ai-preview")).toContainText(
    "Starting weight unassigned",
  );
  expect(savedVersion).toBeNull();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page
    .getByLabel("What would you like to change?", { exact: true })
    .fill("Make the sessions shorter.");
  await page
    .getByRole("button", { name: "Revise program", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Shorter AI block", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("What would you like to change?", { exact: true })
    .fill("One more revision");
  await page
    .getByRole("button", { name: "Revise program", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "previous draft is unchanged",
  );
  await expect(
    page.getByRole("heading", { name: "Shorter AI block", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "/tmp/buff-ai-program-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Save program", exact: true }).click();
  await expect(page).toHaveURL(/tab=programs/);
  expect(savedVersion).toBe(2);
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
    page.getByRole("heading", { name: "Create with AI", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Build my program", exact: true }),
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
    const saved = await owner.request.post(
      "/api/ai-programs/" + "a".repeat(32) + "/save",
      { headers: { Origin: baseURL }, data: { version: 1 } },
    );
    expect(saved.status()).toBe(201);
    const programId = (await saved.json()).programId;
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
    const screen = await owner.newPage();
    await screen.goto("/coach?tab=programs");
    await screen
      .getByRole("button", { name: "Create coach profile", exact: false })
      .click();
    await screen.getByRole("button", { name: "Programs", exact: true }).click();
    await expect(
      screen.getByRole("link", { name: "Create with AI", exact: false }),
    ).toHaveAttribute("href", "/create-with-ai?coach=1");
    await expect(
      screen.getByRole("heading", { name: "Seeded AI program", exact: true }),
    ).toBeVisible();
  } finally {
    await owner.close();
  }
});
