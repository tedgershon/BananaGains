/**
 * Single source of truth for per-domain `staleTime` values.
 *
 * All query modules reference these constants — no inline literals. Tune
 * cache freshness for a domain here and every consumer picks it up.
 */
export const STALE = {
  DEFAULT: 30_000,
  MARKETS_LIST: 30_000,
  MARKET_DETAIL: 10_000,
  BETS: 5_000,
  ME: 60_000,
  PORTFOLIO: 30_000,
  TRANSACTIONS: 30_000,
  LEADERBOARD: 30_000,
  NOTIFICATIONS: 0,
  REWARDS: 60_000,
  ADMIN: 0,
  VOTES: 5_000,
} as const;
