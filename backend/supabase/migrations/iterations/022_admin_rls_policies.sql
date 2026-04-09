-- 022: Admin RLS policies for role-based access

-- Admins can update any market (needed for review workflow)
CREATE POLICY "Admins can update any market"
    ON markets FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'super_admin')
        )
    );

-- Admins can view all transactions (for statistics)
CREATE POLICY "Admins can view all transactions"
    ON transactions FOR SELECT
    USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'super_admin')
        )
    );

-- Super admin can update any profile's role
CREATE POLICY "Super admin can update any profile"
    ON profiles FOR UPDATE
    USING (
        auth.uid() = id
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'super_admin'
        )
    );
