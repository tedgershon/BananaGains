-- 006_auth_cmu_domain_trigger.sql
-- Enforce @andrew.cmu.edu emails at account creation (auth.users insert).

CREATE OR REPLACE FUNCTION public.enforce_cmu_email_domain()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.email IS NULL OR lower(NEW.email) NOT LIKE '%@andrew.cmu.edu' THEN
        RAISE EXCEPTION 'Only @andrew.cmu.edu emails are allowed.';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_cmu_email_domain ON auth.users;

CREATE TRIGGER enforce_cmu_email_domain
    BEFORE INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_cmu_email_domain();
