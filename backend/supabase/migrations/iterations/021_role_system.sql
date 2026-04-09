-- 021: Replace boolean is_admin with a proper role column

-- Add role column
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'
    CHECK (role IN ('user', 'admin', 'super_admin'));

-- Migrate existing admin flags
UPDATE profiles SET role = 'admin' WHERE is_admin = TRUE;

-- Seed the super admin account (tgershon)
UPDATE profiles SET role = 'super_admin' WHERE andrew_id = 'tgershon';

-- Keep is_admin as a computed convenience for backward compatibility
-- but new code should use the role column
CREATE OR REPLACE FUNCTION profiles_is_admin_sync()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.is_admin := NEW.role IN ('admin', 'super_admin');
    RETURN NEW;
END;
$$;

CREATE TRIGGER sync_is_admin
    BEFORE INSERT OR UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION profiles_is_admin_sync();
