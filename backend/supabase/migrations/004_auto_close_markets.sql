-- 004_auto_close_markets.sql
-- Periodic job to close markets whose close_at has passed.
-- Works alongside the lazy API-layer check for immediate correctness.

CREATE OR REPLACE FUNCTION close_expired_markets()
RETURNS void AS $$
BEGIN
    UPDATE markets
    SET    status = 'closed'
    WHERE  status = 'open'
      AND  close_at <= now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule via pg_cron (available on Supabase Pro / self-hosted).
-- If pg_cron is not enabled, run this SELECT manually or via a
-- Supabase Edge Function with a cron trigger instead.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
    ) THEN
        PERFORM cron.schedule(
            'close-expired-markets',
            '* * * * *',            -- every minute
            'SELECT close_expired_markets()'
        );
    END IF;
END $$;
