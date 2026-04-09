import type { UserProfile } from "./types";

/**
 * Fallback user profile used when Supabase auth is not configured or when
 * the backend is running in demo_mode.
 */
export const DEMO_USER: UserProfile = {
  id: "00000000-0000-0000-0000-000000000001",
  andrew_id: "at2",
  display_name: "Aaron Tang",
  banana_balance: 1000,
  created_at: "2026-03-17T00:00:00Z",
  claimed_today: false,
  role: "user",
  is_admin: false,
  claim_eligible: true,
  claim_amount: 1000,
  above_cap: false,
  equipped_badge_id: null,
  equipped_badges: {},
  avatar_url: null,
};
