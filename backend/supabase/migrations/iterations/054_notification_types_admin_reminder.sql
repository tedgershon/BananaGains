-- Add new notification types for admin alerts and resolution reminders
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
    'market_approved', 'market_denied', 'market_closed',
    'market_resolved', 'payout_received',
    'badge_earned', 'system',
    'market_submitted',      -- Admin: new market needs review
    'resolution_reminder'    -- Creator: reminder to resolve closed market
));
