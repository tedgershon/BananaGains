-- 025: Expand market status to include pending_review and denied

ALTER TABLE markets DROP CONSTRAINT IF EXISTS markets_status_check;
ALTER TABLE markets ADD CONSTRAINT markets_status_check
    CHECK (status IN (
        'pending_review', 'open', 'closed',
        'pending_resolution', 'disputed', 'admin_review', 'resolved',
        'denied'
    ));

-- Change default status to pending_review
ALTER TABLE markets ALTER COLUMN status SET DEFAULT 'pending_review';
