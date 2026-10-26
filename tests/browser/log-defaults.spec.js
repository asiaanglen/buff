import { test, expect } from "@playwright/test";
import { initialState } from "../../src/model.js";
test("target defaults can be accepted without editing and do not complete sets on open", async ({
  page,
}) => {
  const state = initialState();
  await page.addInitScript(
    (data) => localStorage.setItem("buff-v1", JSON.stringify(data)),
    state,
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Log workout" }).click();
  await expect(
    page.getByLabel("Barbell bench press set 1 weight", { exact: true }),
  ).toHaveValue("40");
  await expect(
    page.getByLabel("Barbell bench press set 1 reps", { exact: true }),
  ).toHaveValue("8");
  await expect(
    page.getByLabel("Plank set 1 weight", { exact: true }),
  ).toHaveValue("0");
  await expect(
    page.getByLabel("Plank set 1 seconds", { exact: true }),
  ).toHaveValue("45");
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("buff-v1")).workouts[0].exercises[0]
          .logs[0],
    ),
  ).toEqual({ weight: "", actual: "", done: false });
  await page
    .getByLabel("Barbell bench press set 1 completed", { exact: true })
    .check();
  await page.getByLabel("Plank set 1 completed", { exact: true }).check();
  await page.getByRole("button", { name: "Done logging" }).click();
  await expect(page.locator(".workout-card")).toContainText("2 sets completed");
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("buff-v1")),
  );
  expect(saved.workouts[0].exercises[0].logs[0]).toEqual({
    weight: "40",
    actual: "8",
    done: true,
  });
  expect(saved.workouts[0].exercises[3].logs[0]).toEqual({
    weight: "0",
    actual: "45",
    done: true,
  });
});
test("existing results and zero values are preserved; clearing a default prevents completion", async ({
  page,
}) => {
  const state = initialState();
  state.workouts[0].exercises[0].logs[0] = {
    weight: "0",
    actual: "0",
    done: true,
  };
  state.workouts[0].exercises[0].logs[1] = {
    weight: "95",
    actual: "6",
    done: false,
  };
  await page.addInitScript(
    (data) => localStorage.setItem("buff-v1", JSON.stringify(data)),
    state,
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Continue logging" }).click();
  await expect(
    page.getByLabel("Barbell bench press set 1 weight", { exact: true }),
  ).toHaveValue("0");
  await expect(
    page.getByLabel("Barbell bench press set 1 reps", { exact: true }),
  ).toHaveValue("0");
  await expect(
    page.getByLabel("Barbell bench press set 2 weight", { exact: true }),
  ).toHaveValue("95");
  await expect(
    page.getByLabel("Barbell bench press set 2 reps", { exact: true }),
  ).toHaveValue("6");
  await page
    .getByLabel("Barbell bench press set 3 reps", { exact: true })
    .fill("");
  await page
    .getByLabel("Barbell bench press set 3 completed", { exact: true })
    .click();
  await expect(
    page.getByLabel("Barbell bench press set 3 completed", { exact: true }),
  ).not.toBeChecked();
  await expect(page.locator(".log-intro")).toContainText("Enter both weight");
});
