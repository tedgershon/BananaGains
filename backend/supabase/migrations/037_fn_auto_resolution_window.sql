-- When a market transitions to 'closed', auto-set the resolution window
CREATE OR REPLACE FUNCTION set_resolution_window()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.status = 'closed' AND OLD.status = 'open' AND NEW.resolution_window_end IS NULL THEN
        NEW.resolution_window_end := now() + interval '24 hours';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_set_resolution_window ON markets;
CREATE TRIGGER auto_set_resolution_window
    BEFORE UPDATE ON markets
    FOR EACH ROW EXECUTE FUNCTION set_resolution_window();

-- Also handle the close_expired_markets function
CREATE OR REPLACE FUNCTION close_expired_markets()
RETURNS void AS $$
BEGIN
    UPDATE markets
    SET status = 'closed',
        resolution_window_end = now() + interval '24 hours'
    WHERE status = 'open'
      AND close_at <= now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
