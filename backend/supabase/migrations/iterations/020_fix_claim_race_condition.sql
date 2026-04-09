-- 020: prevent double daily claims via unique index instead of check-then-insert

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_daily_claim
    ON transactions (user_id, CAST((created_at AT TIME ZONE 'America/New_York') AS date))
    WHERE transaction_type = 'daily_claim';
