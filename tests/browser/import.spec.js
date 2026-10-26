import { test, expect } from "./auth-fixture.js";
import { fileURLToPath } from "node:url";
async function open(page) {
  await page.goto("/app");
  await page.getByRole("button", { name: "Programs", exact: false }).click();
  await page
    .getByRole("button", { name: "Import program", exact: false })
    .click();
}
test("CSV program preview imports weeks, exercises and supersets without removing existing workouts", async ({
  page,
}) => {
  await open(page);
  const csv =
    "week,day,workout,exercise,sets,reps,seconds,weight,superset\n1,1,Upper,Row,3,12,,16,A\n1,1,Upper,Press,3,10,,12,A\n2,3,Core,Plank,3,,45,0,\n";
  await page.getByLabel("Program file").setInputFiles({
    name: "My program.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await page.getByLabel("Start date", { exact: true }).fill("2026-11-02");
  await expect(page.locator("#import-preview")).toContainText(
    "2 weeks · 2 workouts · 3 exercises",
  );
  await expect(page.getByLabel("Number of weeks")).toHaveValue("2");
  await page
    .getByRole("button", { name: "Import program →", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "My program", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".superset-label")).toHaveCount(1);
  await page.getByLabel("Go to program week").selectOption("2");
  await expect(page.locator(".workout-card")).toContainText("45 sec");
  const saved = await page.evaluate(() => window.readTestJournal());
  expect(saved.workouts).toHaveLength(3);
  await page.reload();
  await page.getByRole("button", { name: "Programs", exact: false }).click();
  await expect(page.locator(".program-card")).toContainText("My program");
});
test("Excel upload supports choosing a workbook sheet and previews before committing", async ({
  page,
}) => {
  await open(page);
  await page
    .getByLabel("Program file")
    .setInputFiles(
      fileURLToPath(new URL("../fixtures/program.xlsx", import.meta.url)),
    );
  await expect(page.getByLabel("Workbook sheet")).toBeVisible();
  await page.getByLabel("Workbook sheet").selectOption({ label: "Program" });
  await expect(page.locator("#import-preview")).toContainText(
    "2 weeks · 2 workouts · 3 exercises",
  );
  await page.getByLabel("Program name", { exact: true }).fill("Excel build");
  await page
    .getByRole("button", { name: "Import program →", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Excel build", exact: true }),
  ).toBeVisible();
});
test("invalid CSV shows row errors and leaves the journal unchanged", async ({
  page,
}) => {
  await open(page);
  await page.getByLabel("Program file").setInputFiles({
    name: "bad.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("week,exercise,sets,reps,seconds\n1,Plank,3,8,45"),
  });
  await expect(page.locator("#import-preview")).toContainText("Row 2");
  await expect(
    page.getByRole("button", { name: "Import program →", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Close import" }).click();
  expect(
    await page.evaluate(() => window.readTestJournal()?.programs?.length || 0),
  ).toBe(0);
});
