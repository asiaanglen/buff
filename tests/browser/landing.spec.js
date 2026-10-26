import { test, expect } from "@playwright/test";
import { initialState } from "../../src/model.js";
test("signed-out visitors only see the landing page, including direct private URLs", async ({
  page,
}) => {
  const state = initialState();
  state.workouts[0].name = "My saved private workout";
  await page.addInitScript(
    (s) => localStorage.setItem("buff-v1", JSON.stringify(s)),
    state,
  );
  for (const path of ["/", "/app", "/programs", "/history"]) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", {
        name: "Your next chapter starts with a plan.",
      }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator(".sidebar")).toHaveCount(0);
    await expect(
      page.getByText("My saved private workout", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Try the planner", exact: true }),
    ).toHaveCount(0);
  }
  expect((await page.request.get("/api/state")).status()).toBe(401);
});
test("landing page signup leads to the planner, signed-in reloads stay there, and sign-out restores the landing page", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Get started free", exact: false })
    .click();
  await expect(
    page.getByRole("heading", { name: "Create your account" }),
  ).toBeVisible();
  const email = `landing-${Date.now()}@example.com`;
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel(/^Password/).fill("a private landing password");
  await page
    .getByRole("button", { name: "Create account →", exact: true })
    .click();
  await expect(page.locator("#account-root")).toContainText(email);
  await page.getByRole("button", { name: "Close account" }).click();
  await expect(
    page.getByRole("heading", { name: "Your week, in motion." }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Your week, in motion." }),
  ).toBeVisible();
  await expect(page.locator(".landing")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Account and cross-device sync" })
    .click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Your next chapter starts with a plan.",
    }),
  ).toBeVisible();
});
test("landing page works on mobile and sign-in opens the existing account form", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Your next chapter starts with a plan.",
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/tmp/buff-landing-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Sign in to Buff" }),
  ).toBeVisible();
});

test("Google signup appears only when the server reports it configured", async ({
  page,
}) => {
  await page.route("**/api/auth/providers", (r) =>
    r.fulfill({ json: { google: true, googleLinked: false } }),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Get started free", exact: false })
    .click();
  await expect(
    page.getByRole("link", { name: "Continue with Google" }),
  ).toHaveAttribute("href", /\/api\/auth\/google\/start\?return_to=/);
});
test("unconfigured Google sign-in is hidden and fails closed", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Get started free", exact: false })
    .click();
  await expect(
    page.getByRole("link", { name: "Continue with Google" }),
  ).toHaveCount(0);
  expect((await page.request.get("/api/auth/google/start")).status()).toBe(503);
});
