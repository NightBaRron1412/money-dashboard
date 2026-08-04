-- Authenticate protected server routes with a high-entropy gateway secret.
-- The publishable key alone remains unable to access personal-finance rows.
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.money_gateway_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  secret_hash text NOT NULL CHECK (secret_hash ~ '^[0-9a-f]{64}$'),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.money_gateway_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.money_gateway_config
  FROM PUBLIC, anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.money_gateway_config TO service_role;

INSERT INTO public.money_gateway_config (id, secret_hash, updated_at)
VALUES (
  true,
  '439d43c5ddafd21684a0b6152fff944ef2c081396aacbdd1cee7b79558e969dd',
  now()
)
ON CONFLICT (id) DO UPDATE SET
  secret_hash = EXCLUDED.secret_hash,
  updated_at = EXCLUDED.updated_at;

CREATE OR REPLACE FUNCTION public.money_gateway_authorized()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.money_gateway_config
    WHERE id = true
      AND secret_hash = encode(
        extensions.digest(
          COALESCE(
            COALESCE(current_setting('request.headers', true), '{}')::jsonb
              ->> 'x-money-gateway-secret',
            ''
          ),
          'sha256'
        ),
        'hex'
      )
  );
$$;

REVOKE ALL PRIVILEGES ON FUNCTION public.money_gateway_authorized()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.money_gateway_authorized()
  TO anon, service_role;

DO $$
DECLARE
  table_name text;
  policy_record record;
  all_money_tables text[] := ARRAY[
    'money_accounts',
    'money_transactions',
    'money_goals',
    'money_goal_accounts',
    'money_allocation_plans',
    'money_settings',
    'money_holdings',
    'money_subscriptions',
    'money_dividends',
    'money_push_subscriptions',
    'money_notification_logs',
    'money_credit_cards',
    'money_credit_card_charges',
    'money_credit_card_payments',
    'money_reconciliation_sessions',
    'money_reconciliation_actions',
    'money_net_worth_snapshots'
  ];
  user_id_tables text[] := ARRAY[
    'money_accounts',
    'money_transactions',
    'money_goals',
    'money_goal_accounts',
    'money_allocation_plans',
    'money_settings',
    'money_holdings',
    'money_subscriptions',
    'money_dividends',
    'money_push_subscriptions',
    'money_notification_logs',
    'money_credit_cards',
    'money_credit_card_charges',
    'money_credit_card_payments',
    'money_net_worth_snapshots'
  ];
BEGIN
  FOREACH table_name IN ARRAY all_money_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC, anon, authenticated',
      table_name
    );
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO anon',
      table_name
    );
    EXECUTE format(
      'GRANT ALL PRIVILEGES ON TABLE public.%I TO service_role',
      table_name
    );
  END LOOP;

  FOR policy_record IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = ANY(all_money_tables)
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      policy_record.policyname,
      policy_record.tablename
    );
  END LOOP;

  FOREACH table_name IN ARRAY user_id_tables LOOP
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO anon '
      'USING (public.money_gateway_authorized() AND user_id = public.money_owner_id()) '
      'WITH CHECK (public.money_gateway_authorized() AND user_id = public.money_owner_id())',
      table_name || '_gateway',
      table_name
    );
  END LOOP;

  FOREACH table_name IN ARRAY ARRAY[
    'money_reconciliation_sessions',
    'money_reconciliation_actions'
  ] LOOP
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO anon '
      'USING (public.money_gateway_authorized() AND owner_id = public.money_owner_id()) '
      'WITH CHECK (public.money_gateway_authorized() AND owner_id = public.money_owner_id())',
      table_name || '_gateway',
      table_name
    );
  END LOOP;
END $$;

REVOKE ALL PRIVILEGES ON FUNCTION public.money_owner_id()
  FROM PUBLIC, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.get_running_balance(uuid, uuid, date, date)
  FROM PUBLIC, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.find_duplicate_transactions(uuid, uuid, date, date)
  FROM PUBLIC, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.money_increment_failed_attempts(uuid, integer, integer)
  FROM PUBLIC, authenticated;

GRANT EXECUTE ON FUNCTION public.money_owner_id() TO anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_running_balance(uuid, uuid, date, date)
  TO anon, service_role;
GRANT EXECUTE ON FUNCTION public.find_duplicate_transactions(uuid, uuid, date, date)
  TO anon, service_role;
GRANT EXECUTE ON FUNCTION public.money_increment_failed_attempts(uuid, integer, integer)
  TO anon, service_role;

COMMIT;
