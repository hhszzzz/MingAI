-- Drop exact legacy API-key/OAuth objects without cascading so an unexpected
-- dependency stops the migration instead of deleting unrelated objects.

DO $$
DECLARE
  v_job_id bigint;
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    FOR v_job_id IN EXECUTE $query$
      SELECT jobid
      FROM cron.job
      WHERE jobname = 'cleanup-mcp-oauth'
         OR command ILIKE '%cleanup_mcp_oauth_data%'
         OR command ILIKE '%mcp_cleanup_oauth_artifacts%'
    $query$
    LOOP
      EXECUTE format('SELECT cron.unschedule(%s)', v_job_id);
    END LOOP;
  END IF;
END
$$;

DROP TRIGGER IF EXISTS trg_guard_mcp_key_user_updates ON public.mcp_api_keys;

DROP FUNCTION IF EXISTS public.cleanup_mcp_oauth_data();
DROP FUNCTION IF EXISTS public.guard_mcp_key_user_updates();
DROP FUNCTION IF EXISTS public.mcp_verify_api_key(text);
DROP FUNCTION IF EXISTS public.mcp_touch_key_last_used(uuid);
DROP FUNCTION IF EXISTS public.mcp_reset_key(uuid, text);
DROP FUNCTION IF EXISTS public.admin_list_mcp_keys(boolean);
DROP FUNCTION IF EXISTS public.admin_revoke_mcp_key(uuid);
DROP FUNCTION IF EXISTS public.admin_unban_mcp_key(uuid);
DROP FUNCTION IF EXISTS public.mcp_exchange_authorization_code(text, text, timestamptz);
DROP FUNCTION IF EXISTS public.mcp_rotate_refresh_token(text, text, text, text, timestamptz);
DROP FUNCTION IF EXISTS public.mcp_cleanup_oauth_artifacts(timestamptz);

DROP TABLE IF EXISTS public.mcp_oauth_codes;
DROP TABLE IF EXISTS public.mcp_oauth_tokens;
DROP TABLE IF EXISTS public.mcp_oauth_clients;
DROP TABLE IF EXISTS public.mcp_api_keys;
