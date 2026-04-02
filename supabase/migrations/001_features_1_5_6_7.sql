-- ================================================================
-- Migration: Features 1, 5, 6, 7
-- PIN hardening, idempotency, reconciliation, dividends reinvest,
-- running balance, duplicate detection, RLS policies
-- ================================================================

-- ---------------------------------------------------------------
-- Feature 1: PIN Hardening — brute-force columns on settings
-- ---------------------------------------------------------------
ALTER TABLE money_settings
  ADD COLUMN IF NOT EXISTS failed_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until timestamptz;

-- ---------------------------------------------------------------
-- Feature 1: Idempotency key on transactions
-- ---------------------------------------------------------------
ALTER TABLE money_transactions
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_idempotency
  ON money_transactions(user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ---------------------------------------------------------------
-- Feature 1: Currency CHECK on subscriptions (if missing)
-- ---------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'money_subscriptions_currency_check'
  ) THEN
    ALTER TABLE money_subscriptions
      ADD CONSTRAINT money_subscriptions_currency_check
      CHECK (currency IN ('CAD','USD','EGP'));
  END IF;
END$$;

-- ---------------------------------------------------------------
-- Feature 5: Reconciliation tables
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS money_reconciliation_sessions (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id         uuid NOT NULL,
  account_id       uuid NOT NULL REFERENCES money_accounts(id) ON DELETE CASCADE,
  started_at       timestamptz NOT NULL DEFAULT now(),
  date_from        date,
  date_to          date,
  expected_balance numeric(12,2),
  computed_balance numeric(12,2),
  delta            numeric(12,2),
  status           text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','cancelled')),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS money_reconciliation_actions (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id       uuid NOT NULL REFERENCES money_reconciliation_sessions(id) ON DELETE CASCADE,
  owner_id         uuid NOT NULL,
  action_type      text NOT NULL CHECK (action_type IN ('merge','delete','keep_both','adjust')),
  payload_json     jsonb NOT NULL DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_sessions_owner
  ON money_reconciliation_sessions(owner_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_actions_session
  ON money_reconciliation_actions(session_id);

-- ---------------------------------------------------------------
-- Feature 6: Dividend reinvested flag
-- ---------------------------------------------------------------
ALTER TABLE money_dividends
  ADD COLUMN IF NOT EXISTS reinvested boolean NOT NULL DEFAULT false;

-- ---------------------------------------------------------------
-- Feature 7: Index for running balance ordering
-- ---------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_transactions_running_balance
  ON money_transactions(user_id, account_id, date, created_at, id);

CREATE INDEX IF NOT EXISTS idx_transactions_transfer_from
  ON money_transactions(user_id, from_account_id, date, created_at, id)
  WHERE from_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_transfer_to
  ON money_transactions(user_id, to_account_id, date, created_at, id)
  WHERE to_account_id IS NOT NULL;

-- ---------------------------------------------------------------
-- Feature 5: Duplicate detection index
-- ---------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_transactions_dup_detect
  ON money_transactions(user_id, account_id, amount, date);

-- ---------------------------------------------------------------
-- RLS Policies: enable on all user tables, owner_id = fixed UUID
-- ---------------------------------------------------------------
-- We use a helper function so policies reference a single constant.

CREATE OR REPLACE FUNCTION money_owner_id() RETURNS uuid
  LANGUAGE sql IMMUTABLE AS $$
  SELECT '00000000-0000-0000-0000-000000000001'::uuid;
$$;

-- Macro to enable RLS + create policies for a table
-- We'll do it table by table.

-- money_accounts
ALTER TABLE money_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS money_accounts_owner ON money_accounts;
CREATE POLICY money_accounts_owner ON money_accounts
  FOR ALL TO anon, authenticated
  USING (user_id = money_owner_id())
  WITH CHECK (user_id = money_owner_id());

-- money_transactions
ALTER TABLE money_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS money_transactions_owner ON money_transactions;
CREATE POLICY money_transactions_owner ON money_transactions
  FOR ALL TO anon, authenticated
  USING (user_id = money_owner_id())
  WITH CHECK (user_id = money_owner_id());

-- money_goals
ALTER TABLE money_goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS money_goals_owner ON money_goals;
CREATE POLICY money_goals_owner ON money_goals
  FOR ALL TO anon, authenticated
  USING (user_id = money_owner_id())
  WITH CHECK (user_id = money_owner_id());

-- money_goal_accounts
ALTER TABLE money_goal_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS money_goal_accounts_owner ON money_goal_accounts;
CREATE POLICY money_goal_accounts_owner ON money_goal_accounts
  FOR ALL TO anon, authenticated
  USING (user_id = money_owner_id())
  WITH CHECK (user_id = money_owner_id());

-- money_allocation_plans
ALTER TABLE money_allocation_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS money_allocation_plans_owner ON money_allocation_plans;
CREATE POLICY money_allocation_plans_owner ON money_allocation_plans
  FOR ALL TO anon, authenticated
  USING (user_id = money_owner_id())
  WITH CHECK (user_id = money_owner_id());

-- money_settings
ALTER TABLE money_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS money_settings_owner ON money_settings;
CREATE POLICY money_settings_owner ON money_settings
  FOR ALL TO anon, authenticated
  USING (user_id = money_owner_id())
  WITH CHECK (user_id = money_owner_id());

-- money_holdings
ALTER TABLE money_holdings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS money_holdings_owner ON money_holdings;
CREATE POLICY money_holdings_owner ON money_holdings
  FOR ALL TO anon, authenticated
  USING (user_id = money_owner_id())
  WITH CHECK (user_id = money_owner_id());

-- money_subscriptions
ALTER TABLE money_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS money_subscriptions_owner ON money_subscriptions;
CREATE POLICY money_subscriptions_owner ON money_subscriptions
  FOR ALL TO anon, authenticated
  USING (user_id = money_owner_id())
  WITH CHECK (user_id = money_owner_id());

-- money_dividends
ALTER TABLE money_dividends ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS money_dividends_owner ON money_dividends;
CREATE POLICY money_dividends_owner ON money_dividends
  FOR ALL TO anon, authenticated
  USING (user_id = money_owner_id())
  WITH CHECK (user_id = money_owner_id());

-- money_credit_cards
ALTER TABLE money_credit_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS money_credit_cards_owner ON money_credit_cards;
CREATE POLICY money_credit_cards_owner ON money_credit_cards
  FOR ALL TO anon, authenticated
  USING (user_id = money_owner_id())
  WITH CHECK (user_id = money_owner_id());

-- money_credit_card_charges
ALTER TABLE money_credit_card_charges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS money_credit_card_charges_owner ON money_credit_card_charges;
CREATE POLICY money_credit_card_charges_owner ON money_credit_card_charges
  FOR ALL TO anon, authenticated
  USING (user_id = money_owner_id())
  WITH CHECK (user_id = money_owner_id());

-- money_credit_card_payments
ALTER TABLE money_credit_card_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS money_credit_card_payments_owner ON money_credit_card_payments;
CREATE POLICY money_credit_card_payments_owner ON money_credit_card_payments
  FOR ALL TO anon, authenticated
  USING (user_id = money_owner_id())
  WITH CHECK (user_id = money_owner_id());

-- money_reconciliation_sessions
ALTER TABLE money_reconciliation_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS money_reconciliation_sessions_owner ON money_reconciliation_sessions;
CREATE POLICY money_reconciliation_sessions_owner ON money_reconciliation_sessions
  FOR ALL TO anon, authenticated
  USING (owner_id = money_owner_id())
  WITH CHECK (owner_id = money_owner_id());

-- money_reconciliation_actions
ALTER TABLE money_reconciliation_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS money_reconciliation_actions_owner ON money_reconciliation_actions;
CREATE POLICY money_reconciliation_actions_owner ON money_reconciliation_actions
  FOR ALL TO anon, authenticated
  USING (owner_id = money_owner_id())
  WITH CHECK (owner_id = money_owner_id());

-- ---------------------------------------------------------------
-- Grants for new tables
-- ---------------------------------------------------------------
GRANT ALL ON money_reconciliation_sessions TO anon, authenticated;
GRANT ALL ON money_reconciliation_actions TO anon, authenticated;

-- ---------------------------------------------------------------
-- Feature 7: Running balance RPC
-- Computes running balance per transaction for a given account.
-- Uses window function over signed amounts.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_running_balance(
  p_account_id uuid,
  p_owner_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  type text,
  date date,
  amount numeric,
  currency text,
  category text,
  merchant text,
  notes text,
  account_id uuid,
  from_account_id uuid,
  to_account_id uuid,
  is_recurring boolean,
  recurrence text,
  linked_charge_id uuid,
  idempotency_key text,
  created_at timestamptz,
  signed_amount numeric,
  running_balance numeric
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
      t.created_at,
      CASE
        WHEN t.type = 'income' AND t.account_id = p_account_id THEN t.amount
        WHEN t.type = 'expense' AND t.account_id = p_account_id THEN -t.amount
        WHEN t.type = 'transfer' AND t.from_account_id = p_account_id THEN -t.amount
        WHEN t.type = 'transfer' AND t.to_account_id = p_account_id THEN t.amount
        ELSE 0
      END AS signed_amount
    FROM money_transactions t
    WHERE t.user_id = p_owner_id
      AND (
        t.account_id = p_account_id
        OR t.from_account_id = p_account_id
        OR t.to_account_id = p_account_id
      )
  )
  SELECT
    tx.id, tx.type, tx.date, tx.amount, tx.currency, tx.category, tx.merchant,
    tx.notes, tx.account_id, tx.from_account_id, tx.to_account_id,
    tx.is_recurring, tx.recurrence, tx.linked_charge_id, tx.idempotency_key,
    tx.created_at,
    tx.signed_amount,
    (SELECT bal FROM starting) + SUM(tx.signed_amount) OVER (
      ORDER BY tx.date, tx.created_at, tx.id
    ) AS running_balance
  FROM account_txs tx
  WHERE (p_date_from IS NULL OR tx.date >= p_date_from)
    AND (p_date_to IS NULL OR tx.date <= p_date_to)
  ORDER BY tx.date, tx.created_at, tx.id;
$$;

-- ---------------------------------------------------------------
-- Feature 5: Duplicate detection RPC
-- Finds potential duplicate transactions for an account.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION find_duplicate_transactions(
  p_account_id uuid,
  p_owner_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL
)
RETURNS TABLE (
  tx_a_id uuid,
  tx_b_id uuid,
  amount numeric,
  date_a date,
  date_b date,
  merchant_a text,
  merchant_b text,
  score integer
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
    a.id AS tx_a_id,
    b.id AS tx_b_id,
    a.amount,
    a.date AS date_a,
    b.date AS date_b,
    a.merchant AS merchant_a,
    b.merchant AS merchant_b,
    (
      50
      + CASE WHEN a.date = b.date THEN 30 ELSE 10 END
      + CASE WHEN LOWER(TRIM(COALESCE(a.merchant,''))) = LOWER(TRIM(COALESCE(b.merchant,'')))
             AND COALESCE(a.merchant,'') <> '' THEN 20 ELSE 0 END
    )::integer AS score
  FROM scoped a
  JOIN scoped b ON a.id < b.id
    AND a.amount = b.amount
    AND a.type = b.type
    AND ABS(a.date - b.date) <= 1
  ORDER BY score DESC, a.date DESC
  LIMIT 100;
$$;
