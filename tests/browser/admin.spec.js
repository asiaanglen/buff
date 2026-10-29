import { test, expect } from "./auth-fixture.js";
import { passwordProof, authScheme } from "../../src/credentials.js";
test("admin dashboard is owner-only, searchable, mobile friendly, and shows signup and activity timestamps", async ({
  page,
  browser,
  baseURL,
}) => {
  const session = await (await page.request.get("/api/auth/session")).json();
  const userEmail = session.user.email;
  expect((await page.request.get("/api/admin/dashboard")).status()).toBe(403);
  const denied = await page.goto("/admin");
  expect(denied.status()).toBe(403);
  await expect(
    page.getByRole("heading", { name: "Owner access required", exact: true }),
  ).toBeVisible();
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 320, height: 844 },
    extraHTTPHeaders: { "CF-Connecting-IP": "198.18.252.55" },
  });
  try {
    const email = "usage-owner@example.test";
    const login = await context.request.post("/api/auth/signin", {
      headers: { Origin: baseURL },
      data: {
        email,
        password: await passwordProof(email, "usage-owner-only-test-password"),
        credentialVersion: authScheme,
      },
    });
    expect(login.ok()).toBeTruthy();
    const admin = await context.newPage();
    await admin.goto("/");
    await admin
      .getByRole("button", {
        name: "Account and cross-device sync",
        exact: true,
      })
      .click();
    await admin
      .getByRole("link", { name: "Admin dashboard", exact: false })
      .click();
    await expect(
      admin.getByRole("heading", { name: "Admin dashboard", exact: true }),
    ).toBeVisible();
    await admin
      .getByLabel("Find a user by name or email", { exact: true })
      .fill(userEmail);
    const searchResponse = admin.waitForResponse(
      (response) =>
        response.url().includes("/admin?") &&
        response.request().isNavigationRequest(),
    );
    await admin.getByRole("button", { name: "Search", exact: true }).click();
    const searched = await searchResponse;
    expect(searched.status(), await searched.text()).toBe(200);
    const rows = admin.locator("#admin-users tbody tr");
    await expect(rows).toHaveCount(1);
    await expect(rows).toContainText(userEmail);
    await expect(rows).not.toContainText("Not recorded");
    expect(
      await admin.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    const summary = await (
      await context.request.get(
        "/api/admin/dashboard?q=" + encodeURIComponent(userEmail),
      )
    ).json();
    expect(summary.totalUsers).toBe(1);
    expect(summary.users[0].registered_at).toBeGreaterThan(0);
    expect(summary.users[0].last_active_at).toBeGreaterThan(0);
    expect(summary.users[0].password).toBeUndefined();
    expect(summary.users[0].date_of_birth).toBeUndefined();
    await admin.getByRole("link", { name: "30 days", exact: true }).click();
    await expect(admin.locator("#admin-activity tbody tr")).toHaveCount(30);
    await admin
      .getByLabel("Find a user by name or email", { exact: true })
      .fill("no-such-person-unique");
    await admin.getByRole("button", { name: "Search", exact: true }).click();
    await expect(admin.locator("#admin-users tbody")).toContainText(
      "No matching users",
    );
    await admin.screenshot({
      path: "/tmp/buff-admin-mobile.png",
      fullPage: true,
    });
  } finally {
    await context.close();
  }
  const anonymous = await browser.newContext({ baseURL });
  expect((await anonymous.request.get("/api/admin/dashboard")).status()).toBe(
    401,
  );
  await anonymous.close();
});
