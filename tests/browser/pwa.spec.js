import { test, expect } from "@playwright/test";
test("PWA has install metadata, help and a private offline fallback", async ({
  page,
  context,
}) => {
  await page.goto("/");
  const manifest = await (
    await page.request.get("/manifest.webmanifest")
  ).json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.start_url).toBe("/");
  for (const icon of manifest.icons)
    expect((await page.request.get(icon.src)).ok()).toBeTruthy();
  await page.getByRole("button", { name: "Install Buff", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Add to Home Screen");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise((resolve) =>
        navigator.serviceWorker.addEventListener("controllerchange", resolve, {
          once: true,
        }),
      );
  });
  expect(
    await page.evaluate(async () => {
      const cache = await caches.open("buff-install-v1");
      return (await cache.keys()).map((r) => new URL(r.url).pathname);
    }),
  ).toEqual(expect.arrayContaining(["/offline", "/manifest.webmanifest"]));
  expect(
    await page.evaluate(
      async () => (await (await caches.open("buff-install-v1")).keys()).length,
    ),
  ).toBe(6);
  await context.setOffline(true);
  await page.goto("/app");
  await expect(
    page.getByRole("heading", { name: "Reconnect to open Buff." }),
  ).toBeVisible();
  await context.setOffline(false);
  await page.getByRole("link", { name: "Try again" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Your next chapter starts with a plan.",
    }),
  ).toBeVisible();
});
