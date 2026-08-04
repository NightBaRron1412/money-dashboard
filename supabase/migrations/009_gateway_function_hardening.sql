-- Keep gateway authorization inside ordinary RLS privileges and pin function
-- search paths so role-level settings cannot affect object resolution.
BEGIN;

GRANT SELECT ON TABLE public.money_gateway_config TO anon;

CREATE POLICY money_gateway_config_read
ON public.money_gateway_config
FOR SELECT TO anon
USING (
  id = true
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

CREATE OR REPLACE FUNCTION public.money_gateway_authorized()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
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

ALTER FUNCTION public.money_owner_id()
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.get_running_balance(uuid, uuid, date, date)
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.find_duplicate_transactions(uuid, uuid, date, date)
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.money_increment_failed_attempts(uuid, integer, integer)
  SET search_path = pg_catalog, public;

COMMIT;
