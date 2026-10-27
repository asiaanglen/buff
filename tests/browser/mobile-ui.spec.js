import { test, expect } from "./auth-fixture.js";
test("phone UI uses readable exercise cards, full-size inputs and accessible tap targets", async ({
  page,
}) => {
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await expect(page.locator(".sidebar")).toBeVisible();
    expect(
      await page
        .locator(".exercise-name strong")
        .first()
        .evaluate((e) => parseFloat(getComputedStyle(e).fontSize)),
    ).toBeGreaterThanOrEqual(16);
    expect(
      await page
        .locator('[data-action="log"]')
        .first()
        .evaluate((e) => e.getBoundingClientRect().height),
    ).toBeGreaterThanOrEqual(44);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.locator('[data-action="log"]').first().click();
    const field = page.locator('.log-row [data-field="weight"]').first();
    expect(
      await field.evaluate((e) => parseFloat(getComputedStyle(e).fontSize)),
    ).toBeGreaterThanOrEqual(16);
    expect(
      await field.evaluate((e) => e.getBoundingClientRect().height),
    ).toBeGreaterThanOrEqual(44);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `/tmp/buff-mobile-log-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Collapse workout" }).click();
    await page.screenshot({
      path: `/tmp/buff-mobile-workout-${width}.png`,
      fullPage: true,
    });
  }
});

test("Muscle Mami theme is optional, persists across devices and switches back to Classic", async ({
  page,
  browser,
  baseURL,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Account and cross-device sync" })
    .click();
  await expect(page.getByLabel("App theme")).toHaveValue("classic");
  await page.getByLabel("App theme").selectOption("muscle-mami");
  await expect(page.locator("html")).toHaveAttribute(
    "data-theme",
    "muscle-mami",
  );
  await page
    .getByRole("button", { name: "Close account", exact: true })
    .click();
  await expect(page.locator("#sync-label")).toContainText("Synced");
  expect(
    (await (await page.request.get("/api/state")).json()).state.theme,
  ).toBe("muscle-mami");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute(
    "data-theme",
    "muscle-mami",
  );
  const other = await browser.newContext({
    storageState: { cookies: await page.context().cookies(), origins: [] },
    viewport: { width: 320, height: 844 },
  });
  try {
    const phone = await other.newPage();
    await phone.goto(baseURL);
    await expect(phone.locator("html")).toHaveAttribute(
      "data-theme",
      "muscle-mami",
    );
    expect(
      await phone.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await phone.screenshot({
      path: "/tmp/buff-muscle-mami-mobile.png",
      fullPage: true,
    });
  } finally {
    await other.close();
  }
  await page
    .getByRole("button", { name: "Account and cross-device sync" })
    .click();
  await page.getByLabel("App theme").selectOption("classic");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "classic");
  await page
    .getByRole("button", { name: "Close account", exact: true })
    .click();
  await expect(page.locator("#sync-label")).toContainText("Synced");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "classic");
});
