-- Keep ledger amounts whole; only monthly reporting applies the personal share.
alter table public.money_transactions
  add column if not exists personal_share_percent numeric(5,2) not null default 100
    check (personal_share_percent >= 0 and personal_share_percent <= 100),
  add column if not exists shared_with text
    check (shared_with is null or char_length(shared_with) <= 100);
comment on column public.money_transactions.personal_share_percent is
  'Percentage counted in personal spending reports. Does not change account or card balances.';
