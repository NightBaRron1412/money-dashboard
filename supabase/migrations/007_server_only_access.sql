-- Move all personal-finance access behind the authenticated Next.js server.
-- This migration changes grants and policies only. It does not update rows.
BEGIN;

DO $$
DECLARE
  table_name text;
  policy_record record;
  money_tables text[] := ARRAY[
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
BEGIN
  FOREACH table_name IN ARRAY money_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC, anon, authenticated',
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
    WHERE schemaname = 'public' AND tablename = ANY(money_tables)
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      policy_record.policyname,
      policy_record.tablename
    );
  END LOOP;
END $$;

REVOKE ALL PRIVILEGES ON FUNCTION public.money_owner_id()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.get_running_balance(uuid, uuid, date, date)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.find_duplicate_transactions(uuid, uuid, date, date)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.money_increment_failed_attempts(uuid, integer, integer)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.money_owner_id() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_running_balance(uuid, uuid, date, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.find_duplicate_transactions(uuid, uuid, date, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.money_increment_failed_attempts(uuid, integer, integer)
  TO service_role;

COMMIT;
