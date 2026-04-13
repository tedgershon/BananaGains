-- In-app admin alerts when a market is submitted.
-- Direct INSERT into notifications as the creator's JWT is blocked by Supabase/PostgREST
-- for rows where user_id != auth.uid(), even with a permissive WITH CHECK (true) policy.
-- This SECURITY DEFINER RPC runs as the function owner (bypasses RLS on insert) but still
-- enforces auth.uid() = market.creator_id so only the creator can trigger it.

CREATE OR REPLACE FUNCTION public.notify_admins_market_submitted(p_market_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m markets%ROWTYPE;
  creator_name text;
  admin_record RECORD;
  notification_body text;
BEGIN
  SELECT * INTO m FROM markets WHERE id = p_market_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Market not found';
  END IF;
  IF m.creator_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Only the market creator can trigger admin notifications for this market';
  END IF;

  SELECT COALESCE(display_name, andrew_id, 'Unknown') INTO creator_name
  FROM profiles WHERE id = m.creator_id;

  notification_body := format(
    E'A new market has been submitted for review by %s.\n\nTitle: %s\nDescription: %s\nCategory: %s\nClose Date: %s\n\nPlease review the market in the Admin panel.',
    creator_name,
    m.title,
    m.description,
    m.category,
    m.close_at::text
  );

  FOR admin_record IN
    SELECT id FROM profiles WHERE role IN ('admin', 'super_admin')
  LOOP
    INSERT INTO notifications (user_id, type, title, body, metadata)
    VALUES (
      admin_record.id,
      'market_submitted',
      'New Market Awaiting Review',
      notification_body,
      jsonb_build_object('market_id', m.id::text, 'creator_id', m.creator_id::text)
    );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_admins_market_submitted(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_admins_market_submitted(uuid) TO authenticated;
