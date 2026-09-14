# Design audit — 13 September 2026

Reviewed all twelve signed-in/demo sections at desktop and phone widths, plus navigation, search, privacy, add/edit dialogs, and the main financial workflows. Browser checks use isolated demo data; no personal financial records were changed.

| Area | Problem | Resolution |
|---|---|---|
| Income, expenses | Mobile tables hid merchant, account, and edit actions; expense summaries consumed too much space | Responsive transaction lists, visible actions, mobile sorting, two useful expense totals, optional category detail |
| Credit cards, subscriptions | Phone users had to scroll sideways to reach key details and actions | Responsive charge, payment, and subscription lists |
| Accounts | Transfer editing remained cramped; received amount was inaccessible for currency conversions; invalid choices failed silently | Dedicated transfer dialog with received amount, validation feedback, and save/cancel |
| Credit-card payments | Another multi-field editor embedded in table cells | Dedicated payment dialog |
| Stocks | Pencil exposed a limited holding editor; dividends edited in table cells | Full existing holding form and a dedicated dividend editor with notes |
| Market prices | Missing prices could appear as zero values and severe losses | Unavailable/loading labels for portfolio totals and unpriced holdings; omit unpriced performance bars |
| Voice entry | Floating microphone covered cards, tables, and actions | Voice control moved into the shared toolbar |
| Chat | Composer fell below the viewport/navigation; new messages could scroll the whole page | Viewport-sized panel with an independently scrolling message region |
| Shared controls | Small custom switches distorted under mobile sizing rules | Consistent native checkbox controls with touch space |
| Accessibility | Icon-only buttons had no accessible names; many visible labels were disconnected | Named actions and 73 explicit form-label associations |
| Settings | Save was available only at the top of a long page | Additional save action at the end of settings |
| Overview, goals, reports, reconciliation | Reviewed hierarchy, numbers, navigation, overflow, and common actions | Retained working layouts; applied shared toolbar/control improvements |

## Verification

Build and lint passed; 75 unit tests and 39 applicable browser tests passed (three device-inapplicable cases skipped); 13 add/edit dialogs checked without horizontal overflow; visible transfer validation confirmed; 36 dark layout checks across 1440, 390, and 320 pixels passed; route captures on desktop/mobile; dark and narrow layouts; targeted add/edit flows; saving and cancelling edits; mobile sorting and visible controls. Production must identify the pushed GitHub commit before completion.

## Boundaries

This is a design and interaction audit, not a claim that every possible data combination or external market-data response has been tested. Detailed report/holding tables remain horizontally scrollable where comparison across many columns is useful. Income allocation transfers remain independent records. No financial history was rewritten.
