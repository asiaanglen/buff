export async function navigateTo(page, tab) {
  await page.locator(".sidebar").waitFor({ state: "visible" });
  const selector = page.getByRole("combobox", {
    name: "Go to page",
    exact: true,
  });
  if (await selector.isVisible()) await selector.selectOption(tab);
  else await page.locator(`[data-tab="${tab}"]`).click();
}
