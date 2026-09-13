# Money experience redesign

## Direction
A quiet, personal financial workspace: warm neutral surfaces, clear numbers, restrained blue, readable secondary text, and purposeful motion. Inspired by Apple hierarchy and Wealthsimple account organization without copying either brand.

## Audit
Reviewed all twelve demo sections at 1440px and 390px. Overview occupies about 6000px on a phone; expenses puts three large statistics ahead of transactions; settings is almost 4000px tall. Six mobile tabs are crowded. Many row actions are under 32px. Custom modals lack focus containment, restoration, and scroll locking. Income and expenses lack text search. Overview action labels imply opening a form but only navigate to lists.

## Implementation
- Shared typography, compact mobile statistics, larger touch controls, semantic focus and reduced motion.
- Five mobile destinations, accessible More sheet, global searchable page navigation and appearance/privacy actions.
- Persistent utility bar for search and privacy. Keyboard shortcut Ctrl/Cmd K.
- Accessible portal dialogs with focus containment, Escape dismissal, scroll locking, and mobile sheet layout.
- Search income and expenses by merchant, notes, category, and date, composed with existing filters.
- Overview progressive disclosure, honest navigation labels, useful first-account empty state.
- Settings section navigation for quick access to long forms.

## Validation
Build, lint, unit suite, all demo routes, phone and desktop, light and dark, iPhone/WebKit menu and modal behavior, search and keyboard interactions, no horizontal viewport overflow. Verify GitHub and production identify the same commit after release.

## Shared expenses
Added optional personal share percentage and person/group name to expenses and credit-card charges. The full amount remains in ledgers; the rounded personal share is used for reporting and forecasts. Full exclusion overrides sharing. Existing records default to 100 percent. Splits are retained during editing and duplication. This is reporting attribution, not a repayment ledger.

## References
- [Apple typography](https://developer.apple.com/design/human-interface-guidelines/typography)
- [Wealthsimple app organization](https://product-news.wealthsimple.com/meet-our-re-designed-wealthsimple-app-appui)

## Release checks
75 unit tests and 30 browser tests passed (three viewport-inapplicable tests skipped). Reviewed 72 route/width/theme combinations without viewport overflow. Verified a direct account expense of 100 with 60 percent share reports 60 and retains a 100 ledger amount. Applied and verified the additive database migration, including percentage bounds, without changing existing transaction amounts.
