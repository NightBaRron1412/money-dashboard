import { test, expect } from "@playwright/test";

const DEMO_URL = "https://money.amirshetaia.com/demo";

test("tour steps through all pages", async ({ page }) => {
  await page.goto(DEMO_URL, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.removeItem("demo-tour-completed"));
  await page.reload({ waitUntil: "networkidle" });

  const card = page.locator("[class*='rounded-2xl'][class*='shadow-lg']").filter({ hasText: "Step" });
  await expect(card).toBeVisible({ timeout: 10000 });

  const cardTitle = () => card.locator("h3");
  const nextBtn = () => card.locator("button", { hasText: "Next" });

  await expect(cardTitle()).toContainText("Welcome");
  console.log("✓ Welcome");

  const dashSteps = ["Navigation", "Privacy", "AI Greeting", "Financial Summary", "AI Insights", "Charts", "Voice"];
  for (const t of dashSteps) {
    await nextBtn().click();
    await expect(cardTitle()).toContainText(t, { timeout: 5000 });
    console.log(`✓ ${t}`);
  }

  const pages = [
    { url: "income", title: "Income" },
    { url: "expenses", title: "Expense" },
    { url: "credit-cards", title: "Credit Cards" },
    { url: "stocks", title: "Stock" },
    { url: "goals", title: "Savings Goals" },
    { url: "subscriptions", title: "Subscriptions" },
    { url: "reports", title: "Reports" },
    { url: "chat", title: "AI Finance Chat" },
  ];

  for (const p of pages) {
    await nextBtn().click();
    await page.waitForURL(`**/demo/${p.url}`, { timeout: 10000 });
    await expect(cardTitle()).toContainText(p.title, { timeout: 10000 });
    console.log(`✓ ${p.title}`);
  }

  await nextBtn().click();
  await expect(cardTitle()).toContainText("all set", { timeout: 10000 });
  await card.locator("button", { hasText: "Finish" }).click();
  await expect(card).not.toBeVisible({ timeout: 5000 });
  console.log("✓ Complete");
});
