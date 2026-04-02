# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e/tour-mobile.spec.ts >> mobile tour - screenshot each step
- Location: e2e/tour-mobile.spec.ts:7:5

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('[class*=\'rounded-2xl\'][class*=\'shadow-lg\']').filter({ hasText: 'Step' }).locator('button').filter({ hasText: 'Next' })
    - locator resolved to <button class="inline-flex items-center gap-1 rounded-xl bg-accent-purple px-4 py-2 text-sm font-medium text-white shadow-glow transition hover:-translate-y-0.5">…</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - element is outside of the viewport
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - element is outside of the viewport
    - retrying click action
      - waiting 100ms
    47 × waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - element is outside of the viewport
     - retrying click action
       - waiting 500ms

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e4]:
    - navigation [ref=e5]:
      - generic [ref=e6]:
        - link "Home" [ref=e7] [cursor=pointer]:
          - /url: /demo
          - img [ref=e8]
          - generic [ref=e13]: Home
        - link "Income" [ref=e14] [cursor=pointer]:
          - /url: /demo/income
          - img [ref=e15]
          - generic [ref=e18]: Income
        - link "Expenses" [ref=e19] [cursor=pointer]:
          - /url: /demo/expenses
          - img [ref=e20]
          - generic [ref=e23]: Expenses
        - link "Cards" [ref=e24] [cursor=pointer]:
          - /url: /demo/credit-cards
          - img [ref=e25]
          - generic [ref=e27]: Cards
        - link "Accounts" [ref=e28] [cursor=pointer]:
          - /url: /demo/accounts
          - img [ref=e29]
          - generic [ref=e32]: Accounts
        - button "More" [ref=e33] [cursor=pointer]:
          - img [ref=e34]
          - generic [ref=e38]: More
    - main [ref=e39]:
      - generic [ref=e40]:
        - generic [ref=e41]:
          - generic [ref=e42]:
            - heading "Dashboard" [level=1] [ref=e43]
            - paragraph [ref=e44]: Your personal finance overview
          - generic [ref=e46]:
            - link "Add Income" [ref=e47] [cursor=pointer]:
              - /url: /demo/income
              - img [ref=e48]
              - text: Add Income
            - link "Add Expense" [ref=e49] [cursor=pointer]:
              - /url: /demo/expenses
              - img [ref=e50]
              - text: Add Expense
        - generic [ref=e53]:
          - paragraph [ref=e54]: Thursday, Apr 2
          - paragraph [ref=e55]: Good afternoon, Demo User.
          - paragraph [ref=e56]: You're saving 42% this month, up 7% from last month — keep that momentum rolling. Rent lands in 3 days, and you've got it covered.
          - paragraph [ref=e57]: Today timeline
          - generic [ref=e58]:
            - generic [ref=e59]: Netflix in 3 days
            - generic [ref=e60]: Paycheck in 2 days
        - generic [ref=e61]:
          - generic [ref=e62]:
            - generic [ref=e63]:
              - img [ref=e64]
              - heading "AI Insights" [level=3] [ref=e66]
            - button "Refresh" [ref=e67] [cursor=pointer]
          - paragraph [ref=e68]: Your savings rate jumped to 42% this month — nicely above your 3-month average of 35%. Food spending is well controlled at $134. Consider bumping your Emergency Fund transfer from $750 to $900/paycheck — at that pace you'd hit the $20K target by September instead of December. Your Condo Down Payment still needs attention — the $300/month broker top-ups alone won't close the $77K gap fast enough.
        - generic [ref=e69]:
          - generic [ref=e71]:
            - generic [ref=e72]:
              - paragraph [ref=e73]: Cash
              - paragraph [ref=e74]: CA$34,572.52
            - img [ref=e76]
          - generic [ref=e80]:
            - generic [ref=e81]:
              - paragraph [ref=e82]: Portfolio Snapshot
              - paragraph [ref=e83]: CA$7,874.89
              - paragraph [ref=e84]: "Cash added: CA$4,591.92"
            - img [ref=e86]
          - generic [ref=e90]:
            - generic [ref=e91]:
              - paragraph [ref=e92]: Net Worth
              - paragraph [ref=e93]: CA$42,482.95
            - img [ref=e95]
        - generic [ref=e97]:
          - generic [ref=e99]:
            - generic [ref=e100]:
              - paragraph [ref=e101]: Income (this month)
              - paragraph [ref=e102]: CA$180.00
            - img [ref=e104]
          - generic [ref=e107]:
            - generic [ref=e108]:
              - paragraph [ref=e109]: Expenses (this month)
              - paragraph [ref=e110]: CA$0.00
            - img [ref=e112]
          - generic [ref=e116]:
            - generic [ref=e117]:
              - paragraph [ref=e118]: Savings (this month)
              - paragraph [ref=e119]: CA$180.00
              - paragraph [ref=e120]: 100% savings rate
            - img [ref=e122]
        - generic [ref=e125]:
          - generic [ref=e126]:
            - generic [ref=e127]:
              - img [ref=e128]
              - heading "Monthly Budget" [level=2] [ref=e132]
            - generic [ref=e133]: CA$0.00 / CA$3,200.00
          - generic [ref=e136]: 0%
        - generic [ref=e138]:
          - generic [ref=e139]:
            - generic [ref=e140]:
              - img [ref=e141]
              - heading "Recurring Transactions" [level=2] [ref=e146]
            - generic [ref=e147]: 1/2 logged this period
          - generic [ref=e148]:
            - generic [ref=e149]:
              - generic [ref=e152]:
                - paragraph [ref=e153]: Condo Management
                - generic [ref=e154]:
                  - generic [ref=e155]: Expense
                  - generic [ref=e156]: monthly
              - generic [ref=e157]:
                - generic [ref=e158]: CA$2,350.00
                - button "Log again today" [ref=e159] [cursor=pointer]:
                  - img [ref=e160]
                - button "Remove recurring flag" [ref=e163] [cursor=pointer]:
                  - img [ref=e164]
            - generic [ref=e167]:
              - generic [ref=e170]:
                - paragraph [ref=e171]: Acme Robotics
                - generic [ref=e172]:
                  - generic [ref=e173]: Income
                  - generic [ref=e174]: bi-weekly
                  - generic [ref=e175]: ✓ logged
              - generic [ref=e176]:
                - generic [ref=e177]: CA$4,200.00
                - button "Log again today" [ref=e178] [cursor=pointer]:
                  - img [ref=e179]
                - button "Remove recurring flag" [ref=e182] [cursor=pointer]:
                  - img [ref=e183]
        - generic [ref=e186]:
          - heading "Goal Progress" [level=2] [ref=e187]
          - generic [ref=e188]:
            - generic [ref=e189]:
              - generic [ref=e190]:
                - paragraph [ref=e191]: Emergency Fund
                - paragraph [ref=e192]: CA$9,200.00 / CA$20,000.00
              - generic [ref=e195]: 46%
            - generic [ref=e198]:
              - generic [ref=e199]:
                - paragraph [ref=e200]: Condo Down Payment
                - paragraph [ref=e201]: CA$4,174.47 / CA$80,000.00
              - generic [ref=e204]: 5%
        - generic [ref=e207]:
          - heading "Account Balances" [level=2] [ref=e208]
          - generic [ref=e209]:
            - generic [ref=e210]:
              - generic [ref=e213]: Everyday Checking
              - generic [ref=e214]: CA$24,622.52
            - generic [ref=e215]:
              - generic [ref=e218]: Emergency Savings
              - generic [ref=e219]: CA$9,950.00
            - generic [ref=e220]:
              - generic [ref=e223]: Long-Term Investing
              - generic [ref=e224]:
                - text: $3,300.00
                - paragraph [ref=e225]: ≈ CA$4,591.92
        - generic [ref=e226]:
          - generic [ref=e227]:
            - heading "Portfolio" [level=2] [ref=e228]
            - link "View all →" [ref=e229] [cursor=pointer]:
              - /url: /demo/stocks
          - generic [ref=e230]:
            - generic [ref=e232]:
              - generic [ref=e233]:
                - paragraph [ref=e234]: Portfolio Value
                - paragraph [ref=e235]: CA$7,874.89
              - img [ref=e237]
            - generic [ref=e240]:
              - generic [ref=e241]:
                - paragraph [ref=e242]: Total Gain/Loss
                - paragraph [ref=e243]: +CA$2,378.50
                - paragraph [ref=e244]: +43.3%
              - img [ref=e246]
            - generic [ref=e250]:
              - generic [ref=e251]:
                - paragraph [ref=e252]: Today's Change
                - paragraph [ref=e253]: +CA$7.07
              - img [ref=e255]
          - generic [ref=e257]:
            - generic [ref=e258]:
              - generic [ref=e260]: VOO
              - generic [ref=e261]:
                - paragraph [ref=e262]: CA$3,356.22
                - paragraph [ref=e263]: +0.11%
            - generic [ref=e264]:
              - generic [ref=e266]: AAPL
              - generic [ref=e267]:
                - paragraph [ref=e268]: CA$2,848.88
                - paragraph [ref=e269]: +0.11%
            - generic [ref=e270]:
              - generic [ref=e272]: CASH
              - generic [ref=e273]:
                - paragraph [ref=e274]: CA$1,669.79
                - paragraph [ref=e275]: +0.00%
        - generic [ref=e276]:
          - heading "90-Day Cash Flow Forecast" [level=3] [ref=e277]:
            - img [ref=e278]
            - text: 90-Day Cash Flow Forecast
          - generic [ref=e281]:
            - generic [ref=e282]:
              - paragraph [ref=e283]: Avg Monthly Income
              - paragraph [ref=e284]: CA$10,009.25
            - generic [ref=e285]:
              - paragraph [ref=e286]: Avg Monthly Expenses
              - paragraph [ref=e287]: CA$2,833.92
            - generic [ref=e288]:
              - paragraph [ref=e289]: Monthly Net
              - paragraph [ref=e290]: CA$7,175.32
        - generic [ref=e291]:
          - img [ref=e292]
          - text: Charts & Trends
        - generic [ref=e294]:
          - generic [ref=e295]:
            - heading "Net Worth Over Time" [level=3] [ref=e296]
            - application [ref=e299]:
              - generic [ref=e323]:
                - generic [ref=e324]:
                  - generic [ref=e326]: Nov 25
                  - generic [ref=e328]: Dec 25
                  - generic [ref=e330]: Jan 26
                  - generic [ref=e332]: Feb 26
                  - generic [ref=e334]: Apr 26
                - generic [ref=e335]:
                  - generic [ref=e337]: CA$0
                  - generic [ref=e339]: CA$10K
                  - generic [ref=e341]: CA$20K
                  - generic [ref=e343]: CA$30K
                  - generic [ref=e345]: CA$40K
          - generic [ref=e346]:
            - heading "Expenses by Category" [level=3] [ref=e347]
            - application [ref=e350]:
              - generic [ref=e369]:
                - generic [ref=e371]: Rent 88%
                - generic [ref=e373]: Bills 5%
                - generic [ref=e375]: Food 4%
                - generic [ref=e377]: Transport 3%
                - generic [ref=e379]: Fun 1%
          - generic [ref=e380]:
            - heading "Income vs Expenses" [level=3] [ref=e381]
            - generic [ref=e383]:
              - list [ref=e385]:
                - listitem [ref=e386]:
                  - img "Expenses legend icon" [ref=e387]
                  - text: Expenses
                - listitem [ref=e389]:
                  - img "Income legend icon" [ref=e390]
                  - text: Income
              - application [ref=e392]:
                - generic [ref=e438]:
                  - generic [ref=e439]:
                    - generic [ref=e441]: Dec 25
                    - generic [ref=e443]: Jan 26
                    - generic [ref=e445]: Feb 26
                    - generic [ref=e447]: Mar 26
                    - generic [ref=e449]: Apr 26
                  - generic [ref=e450]:
                    - generic [ref=e452]: CA$0
                    - generic [ref=e454]: CA$3.5K
                    - generic [ref=e456]: CA$7K
                    - generic [ref=e458]: CA$10.5K
                    - generic [ref=e460]: CA$14K
          - generic [ref=e461]:
            - heading "Goal Progress" [level=3] [ref=e462]
            - application [ref=e465]:
              - generic [ref=e496]:
                - generic [ref=e497]:
                  - generic [ref=e499]: CA$0
                  - generic [ref=e501]: CA$20K
                  - generic [ref=e503]: CA$40K
                  - generic [ref=e505]: CA$80K
                - generic [ref=e506]:
                  - generic [ref=e508]: EmergencyFund
                  - generic [ref=e510]: Condo DownPayment
        - generic [ref=e511]:
          - generic [ref=e512]: Try voice input
          - generic [ref=e513]: 🎙️
    - button "Record a transaction" [ref=e516] [cursor=pointer]:
      - img [ref=e517]
  - alert [ref=e520]
  - generic [ref=e521]: Emergency Fund
  - generic:
    - generic:
      - img
    - generic [ref=e525]:
      - img [ref=e526]
      - generic [ref=e528]:
        - generic [ref=e529]:
          - generic [ref=e530]: Step 3 of 17
          - button "Close tour" [ref=e531] [cursor=pointer]:
            - img [ref=e532]
        - generic [ref=e537]:
          - text: 👁️
          - heading "Privacy Mode" [level=3] [ref=e538]
          - paragraph [ref=e539]: Toggle this to hide or show all monetary values. Great for when you're sharing your screen.
        - generic [ref=e540]:
          - button "Back" [ref=e541] [cursor=pointer]:
            - img [ref=e542]
            - text: Back
          - generic [ref=e544]:
            - button "Skip tour" [ref=e545] [cursor=pointer]
            - button "Next" [active] [ref=e546] [cursor=pointer]:
              - text: Next
              - img [ref=e547]
```

# Test source

```ts
  1  | import { test, expect, devices } from "@playwright/test";
  2  | 
  3  | const DEMO_URL = "https://money.amirshetaia.com/demo";
  4  | 
  5  | test.use({ ...devices["Pixel 7"] });
  6  | 
  7  | test("mobile tour - screenshot each step", async ({ page }) => {
  8  |   await page.goto(DEMO_URL, { waitUntil: "networkidle" });
  9  |   await page.evaluate(() => localStorage.removeItem("demo-tour-completed"));
  10 |   await page.reload({ waitUntil: "networkidle" });
  11 | 
  12 |   const card = page.locator("[class*='rounded-2xl'][class*='shadow-lg']").filter({ hasText: "Step" });
  13 |   await expect(card).toBeVisible({ timeout: 12000 });
  14 | 
  15 |   const nextBtn = () => card.locator("button", { hasText: "Next" });
  16 |   const cardTitle = () => card.locator("h3");
  17 | 
  18 |   const steps = [
  19 |     "Welcome", "Navigation", "Privacy", "AI Greeting",
  20 |     "Financial Summary", "AI Insights", "Charts", "Voice",
  21 |     "Income", "Expense", "Credit Cards", "Stock",
  22 |     "Savings Goals", "Subscriptions", "Reports", "AI Finance Chat", "all set"
  23 |   ];
  24 | 
  25 |   for (let i = 0; i < steps.length; i++) {
  26 |     const title = steps[i];
  27 |     await expect(cardTitle()).toContainText(title, { timeout: 12000 });
  28 | 
  29 |     // Check if card is in viewport
  30 |     const box = await card.boundingBox();
  31 |     const vp = page.viewportSize()!;
  32 |     const inView = box && box.y >= -5 && (box.y + box.height) <= vp.height + 5;
  33 |     
  34 |     await page.screenshot({ 
  35 |       path: `test-results/mobile-step-${String(i + 1).padStart(2, "0")}-${title.replace(/\s+/g, "-")}.png`,
  36 |       fullPage: false 
  37 |     });
  38 | 
  39 |     if (!inView) {
  40 |       console.log(`⚠ Step ${i + 1} "${title}" card OUT OF VIEWPORT: y=${box?.y?.toFixed(0)} h=${box?.height?.toFixed(0)} vpH=${vp.height}`);
  41 |     } else {
  42 |       console.log(`✓ Step ${i + 1} "${title}" in viewport`);
  43 |     }
  44 | 
  45 |     if (i < steps.length - 1) {
> 46 |       await nextBtn().click();
     |                       ^ Error: locator.click: Test timeout of 30000ms exceeded.
  47 |       await page.waitForTimeout(600);
  48 |     }
  49 |   }
  50 | 
  51 |   await card.locator("button", { hasText: "Finish" }).click();
  52 |   await expect(card).not.toBeVisible({ timeout: 5000 });
  53 |   console.log("✓ Tour complete");
  54 | });
  55 | 
```