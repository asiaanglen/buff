import { test, expect } from "./auth-fixture.js";
test("Connect to AI explains both services and copies the correct connector URL on phones", async ({
  page,
  baseURL,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Connect to AI", exact: false })
    .click();
  await expect(
    page.getByRole("heading", { name: "Connect to AI", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Connect to Claude" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Connect to ChatGPT" }),
  ).toBeVisible();
  await expect(page.getByLabel("Server URL", { exact: true })).toHaveValue(
    baseURL + "/mcp",
  );
  await page.getByRole("button", { name: "Copy URL", exact: true }).click();
  await expect(page.locator("#ai-copy-status")).toContainText("Copied.");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    baseURL + "/mcp",
  );
  await expect(
    page.getByRole("link", { name: "Manage connected AI apps" }),
  ).toHaveAttribute("href", "/connections");
  await expect(
    page.getByText("Every proposed change has an approval link.", {
      exact: false,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/tmp/buff-connect-ai-mobile.png",
    fullPage: true,
  });
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error("denied")) },
    }),
  );
  await page.getByRole("button", { name: "Copy URL", exact: true }).click();
  await expect(page.locator("#ai-copy-status")).toContainText("URL selected.");
});
