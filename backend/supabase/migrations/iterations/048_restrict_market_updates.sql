-- 048_restrict_market_updates.sql
-- Remove overly permissive creator update policy.
-- Creators can NEVER update markets after creation.
-- Market fields are only editable by admins during review.

DROP POLICY IF EXISTS "Creators can update own markets" ON markets;

-- Ensure admin update policy exists (may have been created in 022_admin_rls_policies.sql)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'markets'
        AND policyname = 'Admins can update any market'
    ) THEN
        CREATE POLICY "Admins can update any market"
            ON markets FOR UPDATE
            USING (
                EXISTS (
                    SELECT 1 FROM profiles
                    WHERE profiles.id = auth.uid()
                    AND profiles.role IN ('admin', 'super_admin')
                )
            );
    END IF;
END $$;

-- Prevent modifications to resolved markets' key fields
CREATE OR REPLACE FUNCTION prevent_resolved_market_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.status = 'resolved' AND NEW.status = 'resolved' THEN
        IF NEW.title != OLD.title OR NEW.description != OLD.description
           OR NEW.resolution_criteria != OLD.resolution_criteria THEN
            RAISE EXCEPTION 'Cannot modify a resolved market';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_resolved_market ON markets;
CREATE TRIGGER guard_resolved_market
    BEFORE UPDATE ON markets
    FOR EACH ROW EXECUTE FUNCTION prevent_resolved_market_update();
