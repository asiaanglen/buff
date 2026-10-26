export async function openExercise(page, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const accordion = page
    .locator(".exercise-accordion")
    .filter({
      has: page.getByRole("heading", {
        name: new RegExp(`^${escapedName}(?: Superset .*)?$`),
      }),
    });
  if (!(await accordion.evaluate((e) => e.open)))
    await accordion.locator("h3").click();
}
