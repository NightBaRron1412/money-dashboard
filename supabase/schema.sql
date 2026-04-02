-- ================================================================
-- Personal Finance Dashboard – Supabase Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ================================================================
--
-- Auth: PIN-based (verified server-side). No Supabase Auth needed.
-- All rows use a fixed owner UUID: 00000000-0000-0000-0000-000000000001
-- RLS is mostly disabled – the PIN is the security layer.
-- For push-notification tables, RLS is enabled with fixed-owner policies
-- to satisfy Supabase security checks while preserving current behavior.
-- ================================================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------
create table if not exists money_accounts (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid not null default '00000000-0000-0000-0000-000000000001'::uuid,
  name             text not null,
  type             text not null check (type in ('checking', 'investing')),
  currency         text not null default 'CAD' check (currency in ('CAD','USD','EGP')),
  starting_balance numeric(12,2) not null default 0,
  created_at       timestamptz not null default now()
);

alter table money_accounts disable row level security;
alter table money_accounts
  add column if not exists currency text not null default 'CAD'
  check (currency in ('CAD','USD','EGP'));

-- ---------------------------------------------------------------
-- Transactions
-- ---------------------------------------------------------------
create table if not exists money_transactions (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null default '00000000-0000-0000-0000-000000000001'::uuid,
  type            text not null check (type in ('income', 'expense', 'transfer')),
  date            date not null default current_date,
  amount          numeric(12,2) not null check (amount >= 0),
  currency        text not null default 'CAD' check (currency in ('CAD','USD','EGP')),
  category        text,
  account_id      uuid references money_accounts(id) on delete set null,
  from_account_id uuid references money_accounts(id) on delete set null,
  to_account_id   uuid references money_accounts(id) on delete set null,
  merchant        text,
  notes           text,
  created_at      timestamptz not null default now()
);

alter table money_transactions disable row level security;
alter table money_transactions
  add column if not exists currency text not null default 'CAD'
  check (currency in ('CAD','USD','EGP'));

-- ---------------------------------------------------------------
-- Goals
-- ---------------------------------------------------------------
create table if not exists money_goals (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null default '00000000-0000-0000-0000-000000000001'::uuid,
  name              text not null,
  target_amount     numeric(12,2),
  linked_account_id uuid references money_accounts(id) on delete set null,
  created_at        timestamptz not null default now()
);

alter table money_goals disable row level security;

-- ---------------------------------------------------------------
-- Goal <-> Account Links (many-to-many)
-- ---------------------------------------------------------------
create table if not exists money_goal_accounts (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null default '00000000-0000-0000-0000-000000000001'::uuid,
  goal_id    uuid not null references money_goals(id) on delete cascade,
  account_id uuid not null references money_accounts(id) on delete cascade,
  allocated_amount numeric(12,2) check (allocated_amount >= 0),
  created_at timestamptz not null default now(),
  unique (goal_id, account_id)
);

alter table money_goal_accounts disable row level security;
alter table money_goal_accounts
  add column if not exists allocated_amount numeric(12,2)
  check (allocated_amount >= 0);

-- ---------------------------------------------------------------
-- Allocation Plans
-- ---------------------------------------------------------------
create table if not exists money_allocation_plans (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null default '00000000-0000-0000-0000-000000000001'::uuid,
  name        text not null,
  is_active   boolean not null default false,
  allocations jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

alter table money_allocation_plans disable row level security;

-- ---------------------------------------------------------------
-- Settings (single row per user)
-- ---------------------------------------------------------------
create table if not exists money_settings (
  id                       uuid primary key default uuid_generate_v4(),
  user_id                  uuid not null unique default '00000000-0000-0000-0000-000000000001'::uuid,
  pin_hash                 text,
  base_currency            text not null default 'CAD' check (base_currency in ('CAD','USD','EGP')),
  display_name             text not null default 'User',
  greeting_tone            text not null default 'coach',
  expense_categories       jsonb not null default '["Food","Transport","Bills","Rent","Fun","Health","Personal Care","Other"]'::jsonb
                           check (jsonb_typeof(expense_categories) = 'array'),
  subscription_categories  jsonb not null default '["Streaming","Music","Software","Cloud","Gaming","News","Fitness","Food","Finance","Other"]'::jsonb
                           check (jsonb_typeof(subscription_categories) = 'array'),
  rent_amount              numeric(10,2) not null default 1500,
  rent_day                 integer not null default 1,
  rent_reminder_days       integer not null default 7 check (rent_reminder_days between 0 and 30),
  bill_reminder_days       integer not null default 3 check (bill_reminder_days between 0 and 30),
  monthly_essentials_budget numeric(10,2) not null default 2000,
  paycheck_amount          numeric(10,2) not null default 3000,
  paycheck_frequency       text not null default 'bi-weekly' check (paycheck_frequency in ('weekly','bi-weekly','monthly')),
  auto_apply_allocation    boolean not null default true,
  dismissed_merchants      jsonb not null default '[]'::jsonb,
  created_at               timestamptz not null default now()
);

alter table money_settings disable row level security;
alter table money_settings
  add column if not exists base_currency text not null default 'CAD'
  check (base_currency in ('CAD','USD','EGP'));
alter table money_settings
  add column if not exists display_name text not null default 'Amir';
alter table money_settings
  add column if not exists greeting_tone text not null default 'coach';
alter table money_settings
  add column if not exists expense_categories jsonb not null
  default '["Food","Transport","Bills","Rent","Fun","Health","Personal Care","Other"]'::jsonb;
alter table money_settings
  add column if not exists subscription_categories jsonb not null
  default '["Streaming","Music","Software","Cloud","Gaming","News","Fitness","Food","Finance","Other"]'::jsonb;
alter table money_settings
  add column if not exists rent_reminder_days integer not null default 7
  check (rent_reminder_days between 0 and 30);
alter table money_settings
  add column if not exists bill_reminder_days integer not null default 3
  check (bill_reminder_days between 0 and 30);

-- ---------------------------------------------------------------
-- Grants – allow the anon & authenticated roles full access
-- ---------------------------------------------------------------
grant all on money_accounts to anon, authenticated;
grant all on money_transactions to anon, authenticated;
grant all on money_goals to anon, authenticated;
grant all on money_goal_accounts to anon, authenticated;
grant all on money_allocation_plans to anon, authenticated;
grant all on money_settings to anon, authenticated;

-- ---------------------------------------------------------------
-- Stock Holdings
-- ---------------------------------------------------------------
create table if not exists money_holdings (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid not null default '00000000-0000-0000-0000-000000000001'::uuid,
  account_id       uuid not null references money_accounts(id) on delete cascade,
  symbol           text not null,
  shares           numeric(14,6) not null default 0,
  cost_basis       numeric(12,2) not null default 0,
  cost_currency    text not null default 'USD' check (cost_currency in ('CAD','USD','EGP')),
  created_at       timestamptz not null default now()
);

alter table money_holdings disable row level security;
alter table money_holdings
  add column if not exists cost_currency text not null default 'USD'
  check (cost_currency in ('CAD','USD','EGP'));
grant all on money_holdings to anon, authenticated;

-- ---------------------------------------------------------------
-- Recurring fields on transactions
-- ---------------------------------------------------------------
alter table money_transactions add column if not exists recurrence text check (recurrence in ('weekly','bi-weekly','monthly','yearly'));
alter table money_transactions add column if not exists is_recurring boolean not null default false;

-- ---------------------------------------------------------------
-- Goal target date
-- ---------------------------------------------------------------
alter table money_goals add column if not exists target_date date;

-- ---------------------------------------------------------------
-- Subscriptions
-- ---------------------------------------------------------------
create table if not exists money_subscriptions (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid not null default '00000000-0000-0000-0000-000000000001'::uuid,
  name             text not null,
  amount           numeric(12,2) not null,
  currency         text not null default 'CAD',
  frequency        text not null default 'monthly' check (frequency in ('weekly','bi-weekly','monthly','yearly')),
  category         text,
  next_billing     date not null default current_date,
  is_active        boolean not null default true,
  notes            text,
  created_at       timestamptz not null default now()
);

alter table money_subscriptions disable row level security;
alter table money_subscriptions
  add column if not exists payment_account_id text;
grant all on money_subscriptions to anon, authenticated;

-- ---------------------------------------------------------------
-- Dividends
-- ---------------------------------------------------------------
create table if not exists money_dividends (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid not null default '00000000-0000-0000-0000-000000000001'::uuid,
  holding_id       uuid not null references money_holdings(id) on delete cascade,
  symbol           text not null,
  amount           numeric(12,2) not null,
  currency         text not null default 'USD' check (currency in ('CAD','USD','EGP')),
  date             date not null default current_date,
  notes            text,
  created_at       timestamptz not null default now()
);

alter table money_dividends disable row level security;
alter table money_dividends
  add column if not exists currency text not null default 'USD'
  check (currency in ('CAD','USD','EGP'));
grant all on money_dividends to anon, authenticated;

-- ---------------------------------------------------------------
-- Web Push Subscriptions (background notifications)
-- ---------------------------------------------------------------
create table if not exists money_push_subscriptions (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null default '00000000-0000-0000-0000-000000000001'::uuid,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  expires_at  timestamptz,
  user_agent  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table money_push_subscriptions enable row level security;
grant all on money_push_subscriptions to anon, authenticated;
drop policy if exists money_push_subscriptions_select_policy on money_push_subscriptions;
create policy money_push_subscriptions_select_policy
  on money_push_subscriptions
  for select
  to anon, authenticated
  using (user_id = '00000000-0000-0000-0000-000000000001'::uuid);
drop policy if exists money_push_subscriptions_insert_policy on money_push_subscriptions;
create policy money_push_subscriptions_insert_policy
  on money_push_subscriptions
  for insert
  to anon, authenticated
  with check (user_id = '00000000-0000-0000-0000-000000000001'::uuid);
drop policy if exists money_push_subscriptions_update_policy on money_push_subscriptions;
create policy money_push_subscriptions_update_policy
  on money_push_subscriptions
  for update
  to anon, authenticated
  using (user_id = '00000000-0000-0000-0000-000000000001'::uuid)
  with check (user_id = '00000000-0000-0000-0000-000000000001'::uuid);
drop policy if exists money_push_subscriptions_delete_policy on money_push_subscriptions;
create policy money_push_subscriptions_delete_policy
  on money_push_subscriptions
  for delete
  to anon, authenticated
  using (user_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- ---------------------------------------------------------------
-- Notification Logs (dedupe)
-- ---------------------------------------------------------------
create table if not exists money_notification_logs (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null default '00000000-0000-0000-0000-000000000001'::uuid,
  channel     text not null default 'webpush' check (channel in ('webpush')),
  dedupe_key  text not null unique,
  title       text not null,
  body        text not null,
  created_at  timestamptz not null default now()
);

alter table money_notification_logs enable row level security;
grant all on money_notification_logs to anon, authenticated;
drop policy if exists money_notification_logs_select_policy on money_notification_logs;
create policy money_notification_logs_select_policy
  on money_notification_logs
  for select
  to anon, authenticated
  using (user_id = '00000000-0000-0000-0000-000000000001'::uuid);
drop policy if exists money_notification_logs_insert_policy on money_notification_logs;
create policy money_notification_logs_insert_policy
  on money_notification_logs
  for insert
  to anon, authenticated
  with check (user_id = '00000000-0000-0000-0000-000000000001'::uuid);
drop policy if exists money_notification_logs_update_policy on money_notification_logs;
create policy money_notification_logs_update_policy
  on money_notification_logs
  for update
  to anon, authenticated
  using (user_id = '00000000-0000-0000-0000-000000000001'::uuid)
  with check (user_id = '00000000-0000-0000-0000-000000000001'::uuid);
drop policy if exists money_notification_logs_delete_policy on money_notification_logs;
create policy money_notification_logs_delete_policy
  on money_notification_logs
  for delete
  to anon, authenticated
  using (user_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- ---------------------------------------------------------------
-- Credit Cards
-- ---------------------------------------------------------------
create table if not exists money_credit_cards (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid not null default '00000000-0000-0000-0000-000000000001'::uuid,
  name             text not null,
  currency         text not null default 'CAD' check (currency in ('CAD','USD','EGP')),
  credit_limit     numeric(12,2) not null default 0,
  linked_account_id uuid references money_accounts(id) on delete set null,
  created_at       timestamptz not null default now()
);

alter table money_credit_cards disable row level security;
grant all on money_credit_cards to anon, authenticated;

-- ---------------------------------------------------------------
-- Credit Card Charges (purchases on the card)
-- ---------------------------------------------------------------
create table if not exists money_credit_card_charges (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid not null default '00000000-0000-0000-0000-000000000001'::uuid,
  card_id          uuid not null references money_credit_cards(id) on delete cascade,
  date             date not null default current_date,
  amount           numeric(12,2) not null check (amount >= 0),
  merchant         text,
  category         text,
  notes            text,
  created_at       timestamptz not null default now()
);

alter table money_credit_card_charges disable row level security;
grant all on money_credit_card_charges to anon, authenticated;

-- Link CC charges ↔ expense transactions for bidirectional sync
alter table money_credit_card_charges
  add column if not exists linked_transaction_id uuid references money_transactions(id) on delete set null;
alter table money_transactions
  add column if not exists linked_charge_id uuid references money_credit_card_charges(id) on delete set null;

-- ---------------------------------------------------------------
-- Credit Card Payments (paying off the card from an account)
-- ---------------------------------------------------------------
create table if not exists money_credit_card_payments (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid not null default '00000000-0000-0000-0000-000000000001'::uuid,
  card_id          uuid not null references money_credit_cards(id) on delete cascade,
  account_id       uuid not null references money_accounts(id) on delete cascade,
  date             date not null default current_date,
  amount           numeric(12,2) not null check (amount >= 0),
  notes            text,
  created_at       timestamptz not null default now()
);

alter table money_credit_card_payments disable row level security;
grant all on money_credit_card_payments to anon, authenticated;

create index if not exists idx_credit_cards_user
  on money_credit_cards(user_id);
create index if not exists idx_credit_card_charges_card
  on money_credit_card_charges(card_id);
create index if not exists idx_credit_card_payments_card
  on money_credit_card_payments(card_id);
create index if not exists idx_credit_card_payments_account
  on money_credit_card_payments(account_id);

-- ---------------------------------------------------------------
-- Indexes for common queries
-- ---------------------------------------------------------------
create index if not exists idx_transactions_user_date
  on money_transactions(user_id, date desc);
create index if not exists idx_transactions_account
  on money_transactions(account_id);
create index if not exists idx_accounts_user
  on money_accounts(user_id);
create index if not exists idx_goal_accounts_goal
  on money_goal_accounts(goal_id);
create index if not exists idx_goal_accounts_account
  on money_goal_accounts(account_id);
create index if not exists idx_push_subscriptions_user
  on money_push_subscriptions(user_id);
create index if not exists idx_notification_logs_user_created
  on money_notification_logs(user_id, created_at desc);
