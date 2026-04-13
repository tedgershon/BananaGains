-- Fix two blatant issues in notifications:
--
-- 1) get_unread_notification_count was missing search_path, flagged by
--    supabase lint 0011. Matches notify_admins_market_submitted which
--    already sets it correctly.
--
-- 2) notify_market_closed / _approved / _denied used a query-then-insert
--    dedup pattern — two concurrent calls could both see "not found" and
--    both insert. This adds a generated market_id column + partial unique
--    index + a SECURITY DEFINER RPC that wraps the insert in ON CONFLICT
--    DO NOTHING so dedup is atomic.
--
-- Side benefit: the RPC bypasses RLS on its own, so these three notify
-- paths no longer need the service-role client.

ALTER FUNCTION public.get_unread_notification_count(uuid) SET search_path = public;

ALTER TABLE public.notifications
    ADD COLUMN IF NOT EXISTS market_id uuid
    GENERATED ALWAYS AS ((metadata->>'market_id')::uuid) STORED;

-- one-per-market rule only applies to lifecycle events; reminders and
-- system notifs can still repeat
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_one_per_market_event
    ON public.notifications (user_id, type, market_id)
    WHERE market_id IS NOT NULL
        AND type IN (
            'market_approved',
            'market_denied',
            'market_closed',
            'market_resolved',
            'payout_received',
            'market_submitted'
        );

CREATE OR REPLACE FUNCTION public.create_market_notification(
    p_user_id uuid,
    p_type text,
    p_title text,
    p_body text,
    p_market_id uuid,
    p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    v_id uuid;
    v_metadata jsonb;
BEGIN
    -- keep the blast radius of this SECURITY DEFINER narrow
    IF p_type NOT IN (
        'market_approved','market_denied','market_closed',
        'market_resolved','payout_received','market_submitted'
    ) THEN
        RAISE EXCEPTION 'type % not allowed through create_market_notification', p_type;
    END IF;
    IF p_market_id IS NULL THEN
        RAISE EXCEPTION 'p_market_id is required';
    END IF;

    v_metadata := COALESCE(p_metadata, '{}'::jsonb)
                  || jsonb_build_object('market_id', p_market_id::text);

    INSERT INTO public.notifications (user_id, type, title, body, metadata)
    VALUES (p_user_id, p_type, p_title, p_body, v_metadata)
    ON CONFLICT (user_id, type, market_id)
        WHERE market_id IS NOT NULL
            AND type IN (
                'market_approved','market_denied','market_closed',
                'market_resolved','payout_received','market_submitted'
            )
    DO NOTHING
    RETURNING id INTO v_id;

    RETURN v_id;  -- NULL when dedup hit
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.create_market_notification(uuid, text, text, text, uuid, jsonb)
    TO authenticated, service_role;
