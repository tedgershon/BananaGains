-- Add avatar_url to profiles for profile photos
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT NULL;
