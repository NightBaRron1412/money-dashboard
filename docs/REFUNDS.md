# Linked expense refunds

- Card charges offer a Refund action, including on paid-off cards. Credit / Refund payment forms and payment editors can also link an original purchase.
- Income entries with source Refund require an original expense. Existing refunds can be linked through Edit Income. These deposits affect bank balances but do not count as earnings.
- `refund_of_transaction_id` links bank deposits or card credits to an expense. PostgreSQL triggers maintain the expense's `refunded_amount` on insertion, editing, unlinking, and deletion. The demo store mirrors this behavior.
- `monthlyAmount` subtracts refunded principal before applying the expense's personal-share percentage. Spending reports are restated in the purchase month; ledger cash/card movements retain their own dates and full amounts. Excluded expenses remain excluded.
- Refunds must be positive, use the purchase currency, occur on or after the purchase date, and not exceed the unrefunded principal across bank and card refunds together. Card refunds must reference a purchase on that card. Remove refund links before deleting a purchase or changing its payment source.
- Unlinked card credits remain statement credits; cashback is not automatically treated as a purchase refund. Historical records are not matched automatically.

Apply `supabase/migrations/20260923010654_linked_expense_refunds.sql` before releasing the UI. No existing refund links are inferred by the migration.

Validation: unit coverage for bank/card balances, partial/full refunds, sharing, edit/delete reversal and over-refund prevention; database checks in a rolled-back transaction; desktop Chromium and mobile WebKit create/edit/unlink flows.
