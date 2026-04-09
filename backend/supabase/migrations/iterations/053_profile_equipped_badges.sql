-- Add per-track equipped badge map to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS equipped_badges JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Backfill from legacy equipped_badge_id when no map exists yet.
UPDATE profiles p
SET equipped_badges = jsonb_build_object(b.track, p.equipped_badge_id::text)
FROM badge_definitions b
WHERE p.equipped_badge_id = b.id
  AND (
    p.equipped_badges IS NULL
    OR p.equipped_badges = '{}'::jsonb
  );
