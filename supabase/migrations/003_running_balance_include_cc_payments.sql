-- Fix running balance to include credit card payments made from the account.
-- Previously, only money_transactions were considered, so CC payments
-- (which reduce the account balance) were missing from the running total.

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
    -- Regular transactions (income, expense, transfer)
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

    UNION ALL

    -- Credit card payments made from this account
    SELECT
      p.id,
      'expense'::text        AS type,
      p.date,
      p.amount,
      COALESCE(cc.currency, (SELECT a.currency FROM money_accounts a WHERE a.id = p_account_id LIMIT 1))::text AS currency,
      'CC Payment'::text     AS category,
      ('Payment → ' || cc.name)::text AS merchant,
      p.notes,
      p.account_id,
      NULL::uuid             AS from_account_id,
      NULL::uuid             AS to_account_id,
      false                  AS is_recurring,
      NULL::text             AS recurrence,
      NULL::uuid             AS linked_charge_id,
      NULL::text             AS idempotency_key,
      p.created_at,
      -p.amount              AS signed_amount
    FROM money_credit_card_payments p
    JOIN money_credit_cards cc ON cc.id = p.card_id
    WHERE p.user_id = p_owner_id
      AND p.account_id = p_account_id
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
