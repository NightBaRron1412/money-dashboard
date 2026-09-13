import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("demo-tour-completed", "true");
  });
});

test("demo dashboard renders its primary content", async ({ page }) => {
  await page.goto("/demo");

  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Overview", level: 1 })).toBeVisible();
  await expect(page.getByText("Total net worth", { exact: true })).toBeVisible();
});

test("every demo section opens without authentication", async ({ page }) => {
  const routes = [
    "income",
    "expenses",
    "credit-cards",
    "stocks",
    "goals",
    "accounts",
    "subscriptions",
    "reports",
    "reconcile",
    "chat",
    "settings",
  ];

  for (const route of routes) {
    await page.goto(`/demo/${route}`);
    await expect(page.getByRole("main").getByRole("heading", { level: 1 }).first()).toBeVisible();
  }
});

test("demo load has no critical console or HTTP errors", async ({ page }) => {
  const consoleErrors: string[] = [];
  const failedResponses: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      failedResponses.push(`${response.status()} ${response.url()}`);
    }
  });

  await page.goto("/demo");
  await expect(page.getByRole("heading", { name: "Overview", level: 1 })).toBeVisible();
  await page.waitForTimeout(1_000);

  expect(consoleErrors).toEqual([]);
  expect(failedResponses).toEqual([]);
});

test("demo never attempts a production snapshot write", async ({ page }) => {
  const snapshotRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/snapshots/capture")) {
      snapshotRequests.push(request.method());
    }
  });

  await page.goto("/demo");
  await expect(page.getByRole("heading", { name: "Overview", level: 1 })).toBeVisible();
  await page.waitForTimeout(500);

  expect(snapshotRequests).toEqual([]);
});

test("mobile overflow navigation reaches settings", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile-"));
  await page.goto("/demo");

  await page.getByRole("button", { name: "More navigation" }).click();
  await expect(page.getByRole("dialog", { name: "Explore Money" })).toBeVisible();
  await page.getByRole("link", { name: "Settings", exact: true }).click();

  await expect(page).toHaveURL(/\/demo\/settings$/);
  await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
});
