// ---------------------------------------------------------------------------
// Domain types (mirror DATA_MODEL.md and backend response schemas)
// ---------------------------------------------------------------------------

export type MarketStatus = "open" | "closed" | "resolved" | "disputed";
export type BetSide = "YES" | "NO";

export interface UserProfile {
  id: string;
  andrew_id: string;
  display_name: string;
  banana_balance: number;
  created_at: string;
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

  resolved_outcome: BetSide | null;
  resolved_at: string | null;
  category: string;
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
  | "voter_reward";

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
}

// ---------------------------------------------------------------------------
// Request types (match backend Pydantic request schemas)
// ---------------------------------------------------------------------------

export interface CreateMarketRequest {
  title: string;
  description: string;
  close_at: string;
  resolution_criteria: string;
  category?: string;
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
