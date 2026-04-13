-- 022: close all expired markets immediately

UPDATE markets
SET status = 'closed'
WHERE status = 'open'
  AND close_at <= now();
