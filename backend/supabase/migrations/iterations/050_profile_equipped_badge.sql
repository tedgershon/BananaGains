-- Add equipped_badge_id to profiles so users can showcase a badge
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS equipped_badge_id UUID
    REFERENCES badge_definitions(id) ON DELETE SET NULL
    DEFAULT NULL;
