import { test, expect } from "@playwright/test";

test("main page looks correct", async ({ page }) => {
  await page.goto("http://localhost:4173/");
  await expect(page).toHaveScreenshot();
});
