import { test, expect, devices } from "@playwright/test";

const DEMO_URL = "https://money.amirshetaia.com/demo";

test.use({ ...devices["Pixel 7"] });

test("mobile tour - screenshot each step", async ({ page }) => {
  await page.goto(DEMO_URL, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.removeItem("demo-tour-completed"));
  await page.reload({ waitUntil: "networkidle" });

  const card = page.locator("[class*='rounded-2xl'][class*='shadow-lg']").filter({ hasText: "Step" });
  await expect(card).toBeVisible({ timeout: 12000 });

  const nextBtn = () => card.locator("button", { hasText: "Next" });
  const cardTitle = () => card.locator("h3");

  const steps = [
    "Welcome", "Navigation", "Privacy", "AI Greeting",
    "Financial Summary", "AI Insights", "Charts", "Voice",
    "Income", "Expense", "Credit Cards", "Stock",
    "Savings Goals", "Subscriptions", "Reports", "AI Finance Chat", "all set"
  ];

  for (let i = 0; i < steps.length; i++) {
    const title = steps[i];
    await expect(cardTitle()).toContainText(title, { timeout: 12000 });

    // Check if card is in viewport
    const box = await card.boundingBox();
    const vp = page.viewportSize()!;
    const inView = box && box.y >= -5 && (box.y + box.height) <= vp.height + 5;
    
    await page.screenshot({ 
      path: `test-results/mobile-step-${String(i + 1).padStart(2, "0")}-${title.replace(/\s+/g, "-")}.png`,
      fullPage: false 
    });

    if (!inView) {
      console.log(`⚠ Step ${i + 1} "${title}" card OUT OF VIEWPORT: y=${box?.y?.toFixed(0)} h=${box?.height?.toFixed(0)} vpH=${vp.height}`);
    } else {
      console.log(`✓ Step ${i + 1} "${title}" in viewport`);
    }

    if (i < steps.length - 1) {
      await nextBtn().click();
      await page.waitForTimeout(600);
    }
  }

  await card.locator("button", { hasText: "Finish" }).click();
  await expect(card).not.toBeVisible({ timeout: 5000 });
  console.log("✓ Tour complete");
});
