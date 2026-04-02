-- Atomic increment for failed PIN attempts to prevent race conditions.
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
