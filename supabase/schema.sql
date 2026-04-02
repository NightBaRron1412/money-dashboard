-- ================================================================
-- Personal Finance Dashboard – Complete Supabase Schema
-- This file is the canonical, standalone database definition.
-- Running this on a fresh Supabase project creates a fully working DB.
--
-- Auth: PIN-based (verified server-side). No Supabase Auth needed.
-- All rows use a fixed owner UUID: 00000000-0000-0000-0000-000000000001
-- RLS is enabled on all tables with owner-scoped policies.
-- ================================================================

create extension if not exists "uuid-ossp";

-- Helper: returns the fixed owner UUID for RLS policies.
CREATE OR REPLACE FUNCTION money_owner_id() RETURNS uuid
  LANGUAGE sql IMMUTABLE AS $$
  SELECT '00000000-0000-0000-0000-000000000001'::uuid;
$$;

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

-- ---------------------------------------------------------------
-- Transactions
-- ---------------------------------------------------------------
create table if not exists money_transactions (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null default '00000000-0000-0000-0000-000000000001'::uuid,
  type            text not null check (type in ('income', 'expense', 'transfer', 'correction')),
  date            date not null default current_date,
  amount          numeric(12,2) not null check (amount >= 0),
  currency        text not null default 'CAD' check (currency in ('CAD','USD','EGP')),
  category        text,
  account_id      uuid references money_accounts(id) on delete set null,
  from_account_id uuid references money_accounts(id) on delete set null,
  to_account_id   uuid references money_accounts(id) on delete set null,
  merchant        text,
  notes           text,
  is_recurring    boolean not null default false,
  recurrence      text check (recurrence in ('weekly','bi-weekly','monthly','yearly')),
  linked_charge_id uuid,  -- FK added after cc_charges table
  idempotency_key text,
  received_amount numeric(12,2),
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- Goals
-- ---------------------------------------------------------------
create table if not exists money_goals (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null default '00000000-0000-0000-0000-000000000001'::uuid,
  name              text not null,
  target_amount     numeric(12,2),
  target_date       date,
  linked_account_id uuid references money_accounts(id) on delete set null,
  created_at        timestamptz not null default now()
);

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
  failed_attempts          integer not null default 0,
  locked_until             timestamptz,
  created_at               timestamptz not null default now()
);

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

-- ---------------------------------------------------------------
-- Subscriptions
-- ---------------------------------------------------------------
create table if not exists money_subscriptions (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid not null default '00000000-0000-0000-0000-000000000001'::uuid,
  name             text not null,
  amount           numeric(12,2) not null,
  currency         text not null default 'CAD' check (currency in ('CAD','USD','EGP')),
  frequency        text not null default 'monthly' check (frequency in ('weekly','bi-weekly','monthly','yearly')),
  category         text,
  next_billing     date not null default current_date,
  is_active        boolean not null default true,
  notes            text,
  payment_account_id text,
  created_at       timestamptz not null default now()
);

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
  reinvested       boolean not null default false,
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- Web Push Subscriptions
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

-- ---------------------------------------------------------------
-- Credit Card Charges
-- ---------------------------------------------------------------
create table if not exists money_credit_card_charges (
  id                    uuid primary key default uuid_generate_v4(),
  user_id               uuid not null default '00000000-0000-0000-0000-000000000001'::uuid,
  card_id               uuid not null references money_credit_cards(id) on delete cascade,
  date                  date not null default current_date,
  amount                numeric(12,2) not null check (amount >= 0),
  merchant              text,
  category              text,
  notes                 text,
  linked_transaction_id uuid references money_transactions(id) on delete set null,
  created_at            timestamptz not null default now()
);

-- Bidirectional link: transactions <-> charges
alter table money_transactions
  add constraint fk_transactions_linked_charge
  foreign key (linked_charge_id) references money_credit_card_charges(id) on delete set null;

-- ---------------------------------------------------------------
-- Credit Card Payments (nullable account_id for cashback/credits)
-- ---------------------------------------------------------------
create table if not exists money_credit_card_payments (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid not null default '00000000-0000-0000-0000-000000000001'::uuid,
  card_id          uuid not null references money_credit_cards(id) on delete cascade,
  account_id       uuid references money_accounts(id) on delete set null,
  date             date not null default current_date,
  amount           numeric(12,2) not null check (amount >= 0),
  notes            text,
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- Reconciliation Sessions
-- ---------------------------------------------------------------
create table if not exists money_reconciliation_sessions (
  id               uuid primary key default uuid_generate_v4(),
  owner_id         uuid not null,
  account_id       uuid not null references money_accounts(id) on delete cascade,
  started_at       timestamptz not null default now(),
  date_from        date,
  date_to          date,
  expected_balance numeric(12,2),
  computed_balance numeric(12,2),
  delta            numeric(12,2),
  status           text not null default 'open' check (status in ('open','resolved','cancelled')),
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- Reconciliation Actions
-- ---------------------------------------------------------------
create table if not exists money_reconciliation_actions (
  id               uuid primary key default uuid_generate_v4(),
  session_id       uuid not null references money_reconciliation_sessions(id) on delete cascade,
  owner_id         uuid not null,
  action_type      text not null check (action_type in ('merge','delete','keep_both','adjust')),
  payload_json     jsonb not null default '{}',
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- Grants – allow anon & authenticated roles full access
-- ---------------------------------------------------------------
grant all on money_accounts to anon, authenticated;
grant all on money_transactions to anon, authenticated;
grant all on money_goals to anon, authenticated;
grant all on money_goal_accounts to anon, authenticated;
grant all on money_allocation_plans to anon, authenticated;
grant all on money_settings to anon, authenticated;
grant all on money_holdings to anon, authenticated;
grant all on money_subscriptions to anon, authenticated;
grant all on money_dividends to anon, authenticated;
grant all on money_push_subscriptions to anon, authenticated;
grant all on money_notification_logs to anon, authenticated;
grant all on money_credit_cards to anon, authenticated;
grant all on money_credit_card_charges to anon, authenticated;
grant all on money_credit_card_payments to anon, authenticated;
grant all on money_reconciliation_sessions to anon, authenticated;
grant all on money_reconciliation_actions to anon, authenticated;

-- ---------------------------------------------------------------
-- RLS Policies: owner-scoped access on all tables
-- ---------------------------------------------------------------

-- Tables using user_id
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY[
    'money_accounts', 'money_transactions', 'money_goals',
    'money_goal_accounts', 'money_allocation_plans', 'money_settings',
    'money_holdings', 'money_subscriptions', 'money_dividends',
    'money_credit_cards', 'money_credit_card_charges', 'money_credit_card_payments'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I_owner ON %I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_owner ON %I FOR ALL TO anon, authenticated USING (user_id = money_owner_id()) WITH CHECK (user_id = money_owner_id())',
      t, t
    );
  END LOOP;
END $$;

-- Push subscriptions (separate policies per operation for Supabase security checks)
alter table money_push_subscriptions enable row level security;
drop policy if exists money_push_subscriptions_select_policy on money_push_subscriptions;
create policy money_push_subscriptions_select_policy on money_push_subscriptions for select to anon, authenticated using (user_id = money_owner_id());
drop policy if exists money_push_subscriptions_insert_policy on money_push_subscriptions;
create policy money_push_subscriptions_insert_policy on money_push_subscriptions for insert to anon, authenticated with check (user_id = money_owner_id());
drop policy if exists money_push_subscriptions_update_policy on money_push_subscriptions;
create policy money_push_subscriptions_update_policy on money_push_subscriptions for update to anon, authenticated using (user_id = money_owner_id()) with check (user_id = money_owner_id());
drop policy if exists money_push_subscriptions_delete_policy on money_push_subscriptions;
create policy money_push_subscriptions_delete_policy on money_push_subscriptions for delete to anon, authenticated using (user_id = money_owner_id());

-- Notification logs
alter table money_notification_logs enable row level security;
drop policy if exists money_notification_logs_select_policy on money_notification_logs;
create policy money_notification_logs_select_policy on money_notification_logs for select to anon, authenticated using (user_id = money_owner_id());
drop policy if exists money_notification_logs_insert_policy on money_notification_logs;
create policy money_notification_logs_insert_policy on money_notification_logs for insert to anon, authenticated with check (user_id = money_owner_id());
drop policy if exists money_notification_logs_update_policy on money_notification_logs;
create policy money_notification_logs_update_policy on money_notification_logs for update to anon, authenticated using (user_id = money_owner_id()) with check (user_id = money_owner_id());
drop policy if exists money_notification_logs_delete_policy on money_notification_logs;
create policy money_notification_logs_delete_policy on money_notification_logs for delete to anon, authenticated using (user_id = money_owner_id());

-- Reconciliation tables use owner_id (not user_id)
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['money_reconciliation_sessions', 'money_reconciliation_actions'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I_owner ON %I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_owner ON %I FOR ALL TO anon, authenticated USING (owner_id = money_owner_id()) WITH CHECK (owner_id = money_owner_id())',
      t, t
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------
create index if not exists idx_transactions_user_date on money_transactions(user_id, date desc);
create index if not exists idx_transactions_account on money_transactions(account_id);
create index if not exists idx_transactions_running_balance on money_transactions(user_id, account_id, date, created_at, id);
create index if not exists idx_transactions_transfer_from on money_transactions(user_id, from_account_id, date, created_at, id) where from_account_id is not null;
create index if not exists idx_transactions_transfer_to on money_transactions(user_id, to_account_id, date, created_at, id) where to_account_id is not null;
create index if not exists idx_transactions_dup_detect on money_transactions(user_id, account_id, amount, date);
create unique index if not exists idx_transactions_idempotency on money_transactions(user_id, idempotency_key) where idempotency_key is not null;
create index if not exists idx_accounts_user on money_accounts(user_id);
create index if not exists idx_goal_accounts_goal on money_goal_accounts(goal_id);
create index if not exists idx_goal_accounts_account on money_goal_accounts(account_id);
create index if not exists idx_push_subscriptions_user on money_push_subscriptions(user_id);
create index if not exists idx_notification_logs_user_created on money_notification_logs(user_id, created_at desc);
create index if not exists idx_credit_cards_user on money_credit_cards(user_id);
create index if not exists idx_credit_card_charges_card on money_credit_card_charges(card_id);
create index if not exists idx_credit_card_payments_card on money_credit_card_payments(card_id);
create index if not exists idx_credit_card_payments_account on money_credit_card_payments(account_id);
create index if not exists idx_reconciliation_sessions_owner on money_reconciliation_sessions(owner_id);
create index if not exists idx_reconciliation_actions_session on money_reconciliation_actions(session_id);

-- ---------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------

-- Running balance RPC (includes CC payments as virtual "expense" rows)
CREATE OR REPLACE FUNCTION get_running_balance(
  p_account_id uuid,
  p_owner_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL
)
RETURNS TABLE (
  id uuid, type text, date date, amount numeric, currency text,
  category text, merchant text, notes text, account_id uuid,
  from_account_id uuid, to_account_id uuid, is_recurring boolean,
  recurrence text, linked_charge_id uuid, idempotency_key text,
  received_amount numeric,
  created_at timestamptz, signed_amount numeric, running_balance numeric
)
LANGUAGE sql STABLE AS $$
  WITH starting AS (
    SELECT COALESCE(
      (SELECT a.starting_balance FROM money_accounts a WHERE a.id = p_account_id AND a.user_id = p_owner_id),
      0
    ) AS bal
  ),
  account_txs AS (
    SELECT
      t.id, t.type, t.date, t.amount, t.currency, t.category, t.merchant,
      t.notes, t.account_id, t.from_account_id, t.to_account_id,
      t.is_recurring, t.recurrence, t.linked_charge_id, t.idempotency_key,
      t.received_amount,
      t.created_at,
      CASE
        WHEN t.type = 'income'     AND t.account_id = p_account_id      THEN t.amount
        WHEN t.type = 'expense'    AND t.account_id = p_account_id      THEN -t.amount
        WHEN t.type = 'transfer'   AND t.from_account_id = p_account_id THEN -t.amount
        WHEN t.type = 'transfer'   AND t.to_account_id = p_account_id   THEN COALESCE(t.received_amount, t.amount)
        WHEN t.type = 'correction' AND t.to_account_id = p_account_id   THEN t.amount
        WHEN t.type = 'correction' AND t.from_account_id = p_account_id THEN -t.amount
        ELSE 0
      END AS signed_amount
    FROM money_transactions t
    WHERE t.user_id = p_owner_id
      AND (t.account_id = p_account_id OR t.from_account_id = p_account_id OR t.to_account_id = p_account_id)

    UNION ALL

    SELECT
      p.id, 'expense'::text, p.date, p.amount,
      COALESCE(cc.currency, (SELECT a.currency FROM money_accounts a WHERE a.id = p_account_id LIMIT 1))::text,
      'CC Payment'::text, ('Payment → ' || cc.name)::text, p.notes,
      p.account_id, NULL::uuid, NULL::uuid, false, NULL::text, NULL::uuid, NULL::text,
      NULL::numeric,
      p.created_at, -p.amount
    FROM money_credit_card_payments p
    JOIN money_credit_cards cc ON cc.id = p.card_id
    WHERE p.user_id = p_owner_id AND p.account_id = p_account_id
  )
  SELECT
    tx.id, tx.type, tx.date, tx.amount, tx.currency, tx.category, tx.merchant,
    tx.notes, tx.account_id, tx.from_account_id, tx.to_account_id,
    tx.is_recurring, tx.recurrence, tx.linked_charge_id, tx.idempotency_key,
    tx.received_amount,
    tx.created_at, tx.signed_amount,
    (SELECT bal FROM starting) + SUM(tx.signed_amount) OVER (ORDER BY tx.date, tx.created_at, tx.id) AS running_balance
  FROM account_txs tx
  WHERE (p_date_from IS NULL OR tx.date >= p_date_from)
    AND (p_date_to IS NULL OR tx.date <= p_date_to)
  ORDER BY tx.date, tx.created_at, tx.id;
$$;

-- Duplicate detection RPC
CREATE OR REPLACE FUNCTION find_duplicate_transactions(
  p_account_id uuid,
  p_owner_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL
)
RETURNS TABLE (
  tx_a_id uuid, tx_b_id uuid, amount numeric,
  date_a date, date_b date, merchant_a text, merchant_b text, score integer
)
LANGUAGE sql STABLE AS $$
  WITH scoped AS (
    SELECT t.*
    FROM money_transactions t
    WHERE t.user_id = p_owner_id
      AND (t.account_id = p_account_id OR t.from_account_id = p_account_id OR t.to_account_id = p_account_id)
      AND (p_date_from IS NULL OR t.date >= p_date_from)
      AND (p_date_to IS NULL OR t.date <= p_date_to)
  )
  SELECT
    a.id, b.id, a.amount, a.date, b.date, a.merchant, b.merchant,
    (50 + CASE WHEN a.date = b.date THEN 30 ELSE 10 END
       + CASE WHEN LOWER(TRIM(COALESCE(a.merchant,''))) = LOWER(TRIM(COALESCE(b.merchant,'')))
              AND COALESCE(a.merchant,'') <> '' THEN 20 ELSE 0 END
    )::integer
  FROM scoped a JOIN scoped b ON a.id < b.id AND a.amount = b.amount AND a.type = b.type AND ABS(a.date - b.date) <= 1
  ORDER BY 8 DESC, a.date DESC LIMIT 100;
$$;

-- Atomic failed PIN attempts increment
CREATE OR REPLACE FUNCTION money_increment_failed_attempts(
  p_owner_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  p_max_attempts int DEFAULT 5,
  p_lockout_minutes int DEFAULT 15
)
RETURNS TABLE(new_count int) AS $$
  UPDATE money_settings
  SET
    failed_attempts = COALESCE(failed_attempts, 0) + 1,
    locked_until = CASE
      WHEN COALESCE(failed_attempts, 0) + 1 >= p_max_attempts
      THEN now() + (p_lockout_minutes || ' minutes')::interval
      ELSE locked_until
    END
  WHERE user_id = p_owner_id
  RETURNING failed_attempts AS new_count;
$$ LANGUAGE sql;
