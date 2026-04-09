-- 007: expand market status from 4 to 6 states
-- adds: pending_resolution, admin_review

ALTER TABLE markets DROP CONSTRAINT IF EXISTS markets_status_check;
ALTER TABLE markets ADD CONSTRAINT markets_status_check
    CHECK (status IN ('open', 'closed', 'pending_resolution', 'disputed', 'admin_review', 'resolved'));
