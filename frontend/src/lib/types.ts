// ---------------------------------------------------------------------------
// Domain types (mirror DATA_MODEL.md and backend response schemas)
// ---------------------------------------------------------------------------

export type MarketStatus =
  | "pending_review"
  | "open"
  | "closed"
  | "pending_resolution"
  | "disputed"
  | "admin_review"
  | "resolved"
  | "denied";
export type BetSide = "YES" | "NO";
export type UserRole = "user" | "admin" | "super_admin";

export interface UserProfile {
  id: string;
  andrew_id: string;
  display_name: string;
  banana_balance: number;
  created_at: string;
  claimed_today: boolean;
  role: UserRole;
  is_admin: boolean;
  claim_eligible: boolean;
  claim_amount: number;
  above_cap: boolean;
  equipped_badge_id: string | null;
  equipped_badges: Record<string, string | null>;
  avatar_url: string | null;
}

export interface Market {
  id: string;
  title: string;
  description: string;

  creator_id: string;
  created_at: string;
  close_at: string;

  status: MarketStatus;

  resolution_criteria: string;
  yes_pool_total: number;
  no_pool_total: number;

  official_source?: string | null;
  yes_criteria?: string | null;
  no_criteria?: string | null;
  ambiguity_criteria?: string | null;
  proposed_outcome?: BetSide | null;
  proposed_at?: string | null;
  dispute_deadline?: string | null;
  resolved_outcome: BetSide | null;
  resolved_at: string | null;
  disputed_at?: string | null;
  disputed_by?: string | null;
  voting_ends_at?: string | null;
  reviewed_by?: string | null;
  review_date?: string | null;
  review_notes?: string | null;
  resolution_window_end?: string | null;
  category: string;
  link?: string | null;
  market_type?: "binary" | "multichoice";
  multichoice_type?: "exclusive" | "non_exclusive" | null;
  options?: MarketOption[] | null;
}

export interface MarketOption {
  id: string;
  market_id: string;
  label: string;
  pool_total: number;
  sort_order: number;
  is_winner?: boolean | null;
  created_at: string;
}

export interface Bet {
  id: string;
  user_id: string;
  market_id: string;

  side: BetSide;
  amount: number;
  created_at: string;
}

export type TransactionType =
  | "initial_grant"
  | "bet_placement"
  | "payout"
  | "voter_stake"
  | "voter_reward"
  | "daily_claim";

export interface Transaction {
  id: string;
  user_id: string;
  market_id: string | null;
  transaction_type: TransactionType;
  amount: number;
  created_at: string;
}

export interface LeaderboardEntry {
  id: string;
  andrew_id: string;
  display_name: string;
  banana_balance: number;
  avatar_url: string | null;
  equipped_badge_id: string | null;
  equipped_badges: Record<string, string | null> | null;
}

// ---------------------------------------------------------------------------
// Request types (match backend Pydantic request schemas)
// ---------------------------------------------------------------------------

export interface CreateMarketRequest {
  title: string;
  description: string;
  close_at: string;
  close_timezone?: string;
  resolution_criteria: string;
  category?: string;
  official_source?: string;
  yes_criteria?: string;
  no_criteria?: string;
  ambiguity_criteria?: string;
  link?: string;
  market_type?: "binary" | "multichoice";
  multichoice_type?: "exclusive" | "non_exclusive";
  options?: string[];
}

export interface ResolveMarketRequest {
  outcome: BetSide;
}

export interface FileDisputeRequest {
  explanation: string;
}

export interface CastVoteRequest {
  vote: BetSide;
}

export interface PlaceBetRequest {
  side: BetSide;
  amount: number;
}

export interface CreateProfileRequest {
  andrew_id: string;
  display_name: string;
}

// ---------------------------------------------------------------------------
// Response types (when they differ from the domain types above)
// ---------------------------------------------------------------------------

export interface PlaceBetResponse {
  bet_id: string;
  new_balance: number;
}

export interface ResolveMarketResponse {
  market_id: string;
  status: MarketStatus;
  proposed_outcome?: BetSide;
  dispute_deadline?: string | null;
  outcome?: BetSide;
}

export interface ClaimDailyResponse {
  new_balance: number;
  claimed_at: string;
}

export interface DisputeResponse {
  id: string;
  market_id: string;
  disputer_id: string;
  explanation: string;
  voting_deadline: string;
  resolved_by_admin: boolean;
  created_at: string;
}

export interface VoteResponse {
  id: string;
  dispute_id: string;
  market_id: string;
  voter_id: string;
  selected_outcome: BetSide;
  created_at: string;
}

export interface PricePoint {
  timestamp: string;
  probability: number;
}

export interface NotificationResponse {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  metadata: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

export interface AdminStats {
  total_users: number;
  users_by_role: Record<string, number>;
  total_markets: number;
  markets_by_status: Record<string, number>;
  total_banana_traded: number;
  total_active_bets: number;
}

export interface UserSearchResult {
  id: string;
  andrew_id: string;
  display_name: string;
  role: UserRole;
  banana_balance: number;
  created_at: string;
}

export interface ReviewMarketRequest {
  action: "approve" | "deny";
  notes?: string | null;
  title?: string | null;
  description?: string | null;
  resolution_criteria?: string | null;
  close_at?: string | null;
  category?: string | null;
  link?: string | null;
}

export interface BackrollRequest {
  side: BetSide;
  amount: number;
}

export interface BackrollResponse {
  bet_id: string;
  market_id: string;
  side: BetSide;
  amount: number;
}

export interface CommunityVote {
  id: string;
  market_id: string;
  voter_id: string;
  selected_outcome: BetSide;
  created_at: string;
}

export interface PlaceMultichoiceBetRequest {
  option_id: string;
  amount: number;
}

export interface WeeklyLeaderboardResponse {
  entries: LeaderboardEntry[];
  week_start: string;
  week_end: string;
}

export interface UserBadge {
  id: string;
  user_id: string;
  badge_id: string;
  badge_name: string;
  badge_description: string;
  badge_icon: string;
  badge_category: string;
  track: string;
  tier: number;
  earned_at: string;
}

export interface RewardsResponse {
  badges: UserBadge[];
  stats: {
    total_bets: number;
    markets_created: number;
    markets_won: number;
    total_earned: number;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Parimutuel yes-probability derived from pool totals
// TODO: later, consider taking into account the fee charged if we're reflecting payout
export function getMarketProbability(market: Market): number {
  const total = market.yes_pool_total + market.no_pool_total;
  if (total === 0) return 50;
  return Math.round((market.yes_pool_total / total) * 100);
}
