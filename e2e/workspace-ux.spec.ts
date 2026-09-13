import { test, expect } from "@playwright/test";

test.beforeEach(async ({page}) => {
  await page.addInitScript(() => localStorage.setItem("demo-tour-completed", "true"));
});

test("search supports keyboard navigation and preserves the demo route", async ({page}) => {
  await page.goto("/demo");
  await expect(page.getByRole("heading", {name:"Overview", level:1})).toBeVisible();
  await page.keyboard.press("Control+k");
  const dialog = page.getByRole("dialog", {name:"Search pages and actions"});
  await expect(dialog).toBeVisible();
  await dialog.getByRole("combobox").fill("subscriptions");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/demo\/subscriptions$/);
  await expect(page.getByRole("heading",{name:"Subscriptions",level:1})).toBeVisible();
});

test("expense search filters and restores transactions", async ({page}) => {
  await page.goto("/demo/expenses");
  const search = page.getByRole("searchbox", {name:"Search expenses"});
  await search.fill("no-such-merchant-xyz");
  await expect(page.getByText("No expenses found",{exact:true})).toBeVisible();
  await search.fill("");
  await expect(page.locator("tbody tr").first()).toBeVisible();
});

test("merchant history is selectable and dialogs restore focus", async ({page}) => {
  await page.goto("/demo/expenses");
  const trigger = page.getByRole("button", {name:"Add Expense",exact:true}).first();
  await trigger.click();
  const dialog = page.getByRole("dialog", {name:"Add Expense"});
  await expect(dialog).toBeVisible();
  const merchant=dialog.getByRole("combobox",{name:"Merchant",exact:true});
  await merchant.focus();
  const first=dialog.getByRole("listbox", {name:"Merchant suggestions"}).getByRole("option").first();
  await expect(first).toBeVisible();
  await merchant.press("ArrowDown");
  await merchant.press("Enter");
  await expect(merchant).not.toHaveValue("");
  await merchant.fill("Entirely New Merchant");
  await expect(merchant).toHaveValue("Entirely New Merchant");
  await merchant.press("Tab");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test("excluded credit card charge updates its linked expense", async ({page}) => {
  await page.goto("/demo/credit-cards");
  await page.getByRole("button",{name:"Add Charge",exact:true}).first().click();
  const dialog=page.getByRole("dialog",{name:"Add Charge"});
  await dialog.locator('select').first().selectOption({index:1});
  await dialog.locator('input[type=number]').fill("12.34");
  await dialog.getByRole("combobox",{name:"Merchant",exact:true}).fill("UX exclusion check");
  await dialog.getByRole("checkbox",{name:/Exclude from monthly totals/}).check();
  await dialog.getByRole("button",{name:"Add Charge",exact:true}).click();
  await expect(dialog).not.toBeVisible();
  const row=page.getByRole("row").filter({hasText:"UX exclusion check"});
  await expect(row.getByRole("button",{name:"Excluded · Include"})).toBeVisible();
  await row.getByRole("button",{name:"Excluded · Include"}).click();
  await expect(row.getByRole("button",{name:"In monthly totals · Exclude"})).toBeVisible();
});

test("shared card expense keeps full payment and counts only the personal share", async ({page}) => {
  await page.goto("/demo/credit-cards");
  await page.getByRole("button",{name:"Add Charge",exact:true}).first().click();
  const dialog=page.getByRole("dialog",{name:"Add Charge"});
  await dialog.locator('select').first().selectOption({index:1});
  await dialog.locator('input[type=number]').first().fill("100");
  await dialog.getByRole("combobox",{name:"Merchant",exact:true}).fill("Shared dinner test");
  await dialog.getByRole("checkbox",{name:"Shared expense"}).check();
  await dialog.getByRole("spinbutton",{name:"Your share (%)"}).fill("60");
  await dialog.getByRole("textbox",{name:"Shared with"}).fill("Alex");
  await expect(dialog.getByText(/60.00/)).toBeVisible();
  await dialog.getByRole("button",{name:"Add Charge",exact:true}).click();
  const row=page.getByRole("row").filter({hasText:"Shared dinner test"});
  await expect(row.getByText("Shared with Alex · 60% yours")).toBeVisible();
  await row.getByRole("button",{name:"Edit charge"}).click();
  await expect(page.getByRole("spinbutton",{name:"Your share (%)"})).toHaveValue("60");
  await page.getByRole("spinbutton",{name:"Your share (%)"}).fill("40");
  await page.getByRole("button",{name:"Save",exact:true}).click();
  await expect(row.getByText("Shared with Alex · 40% yours")).toBeVisible();
  await page.getByRole("button",{name:"Search pages and actions"}).click();
  await page.getByRole("dialog").getByRole("combobox").fill("expenses");
  await page.keyboard.press("Enter");
  await page.getByRole("searchbox",{name:"Search expenses"}).fill("Shared dinner test");
  await expect(page.getByTestId("personal-spending")).toContainText("40.00");
  await expect(page.getByRole("row").filter({hasText:"Shared dinner test"})).toContainText("100.00");
});
