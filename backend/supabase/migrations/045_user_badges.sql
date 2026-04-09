CREATE TABLE IF NOT EXISTS user_badges (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    badge_id        UUID NOT NULL REFERENCES badge_definitions(id),
    track           TEXT NOT NULL,
    tier            INTEGER NOT NULL,
    earned_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, track)  -- one badge per track per user (highest tier)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON user_badges (user_id);

ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User badges are viewable by everyone"
    ON user_badges FOR SELECT USING (true);
CREATE POLICY "System can manage user badges"
    ON user_badges FOR ALL WITH CHECK (true);
