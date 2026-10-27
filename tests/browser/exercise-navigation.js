export async function openExercise(page, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const accordion = page.locator(".exercise-accordion").filter({
    has: page.getByRole("heading", {
      name: new RegExp(`^${escapedName}(?: Superset .*)?$`),
    }),
  });
  if (!(await accordion.evaluate((e) => e.open)))
    await accordion.locator("h3").click();
}
export async function editPlannedExercise(page, name) {
  await page.getByRole("button", { name: "Edit plan", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: `Edit ${name}`, exact: true })
    .click();
}
export async function workoutTool(page, card, name) {
  const button = card.getByRole("button", { name, exact: false });
  if (await button.isVisible()) await button.click();
  else {
    await card.getByRole("button", { name: "Edit plan", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name, exact: false })
      .click();
  }
}
