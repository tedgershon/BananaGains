import { supabase } from "./supabase";
import type {
  AdminStats,
  BackrollRequest,
  BackrollResponse,
  Bet,
  CastVoteRequest,
  ClaimDailyResponse,
  CommunityVote,
  CreateMarketRequest,
  CreateProfileRequest,
  DisputeResponse,
  FileDisputeRequest,
  LeaderboardEntry,
  Market,
  NotificationResponse,
  PlaceBetRequest,
  PlaceBetResponse,
  PlaceMultichoiceBetRequest,
  ResolveMarketRequest,
  ResolveMarketResponse,
  ReviewMarketRequest,
  RewardsResponse,
  Transaction,
  UserBadge,
  UserProfile,
  UserSearchResult,
  VoteResponse,
  WeeklyLeaderboardResponse,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
export const MAX_PROFILE_AVATAR_BYTES = 5 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Fetch helper
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`API ${status}: ${body}`);
    this.name = "ApiError";
  }
}

async function authHeaders(): Promise<HeadersInit> {
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (!supabase) return headers;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.access_token) {
    (headers as Record<string, string>).Authorization =
      `Bearer ${session.access_token}`;
  }
  return headers;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...headers, ...options?.headers },
  });

  const raw = await res.text();

  if (!res.ok) {
    throw new ApiError(res.status, raw);
  }

  if (!raw) {
    return undefined as T;
  }

  return JSON.parse(raw) as T;
}

// ---------------------------------------------------------------------------
// Auth  –  POST /api/auth/*
// ---------------------------------------------------------------------------

export function getMe(): Promise<UserProfile> {
  return apiFetch("/api/auth/me");
}

export function createProfile(
  body: CreateProfileRequest,
): Promise<UserProfile> {
  return apiFetch("/api/auth/profile", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateProfile(body: {
  display_name?: string;
  equipped_badge_id?: string | null;
  equipped_badges?: Record<string, string | null> | null;
  avatar_url?: string | null;
}): Promise<UserProfile> {
  return apiFetch("/api/auth/profile", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function uploadAvatar(
  userId: string,
  file: File,
): Promise<string> {
  const { supabase } = await import("./supabase");
  if (!supabase) throw new Error("Supabase not configured");

  if (!file.type.startsWith("image/")) {
    throw new Error("Please select an image file.");
  }
  if (file.size > MAX_PROFILE_AVATAR_BYTES) {
    throw new Error("Profile photo is too large. Please upload an image under 5 MB.");
  }

  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${userId}/avatar.${ext}`;

  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true });

  if (error) throw error;

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(path);

  return publicUrl;
}

export function claimDaily(): Promise<ClaimDailyResponse> {
  return apiFetch("/api/auth/claim-daily", { method: "POST" });
}

// ---------------------------------------------------------------------------
// Markets  –  /api/markets
// ---------------------------------------------------------------------------

export interface ListMarketsParams {
  status?: string;
  category?: string;
  limit?: number;
  offset?: number;
}

export function listMarkets(params?: ListMarketsParams): Promise<Market[]> {
  const sp = new URLSearchParams();
  if (params?.status) sp.set("status", params.status);
  if (params?.category) sp.set("category", params.category);
  if (params?.limit != null) sp.set("limit", String(params.limit));
  if (params?.offset != null) sp.set("offset", String(params.offset));
  const qs = sp.toString();
  return apiFetch(`/api/markets${qs ? `?${qs}` : ""}`);
}

export function getMarket(marketId: string): Promise<Market> {
  return apiFetch(`/api/markets/${marketId}`);
}

export function createMarket(body: CreateMarketRequest): Promise<Market> {
  return apiFetch("/api/markets", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function resolveMarket(
  marketId: string,
  body: ResolveMarketRequest,
): Promise<ResolveMarketResponse> {
  return apiFetch(`/api/markets/${marketId}/resolve`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function startCommunityResolution(marketId: string): Promise<Market> {
  return apiFetch(`/api/markets/${marketId}/community-resolution`, {
    method: "POST",
  });
}

export function fileDispute(
  marketId: string,
  body: FileDisputeRequest,
): Promise<DisputeResponse> {
  return apiFetch(`/api/markets/${marketId}/dispute`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getDispute(marketId: string): Promise<DisputeResponse> {
  return apiFetch(`/api/markets/${marketId}/dispute`);
}

export function castDisputeVote(
  marketId: string,
  body: CastVoteRequest,
): Promise<VoteResponse> {
  return apiFetch(`/api/markets/${marketId}/dispute/vote`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function listDisputeVotes(marketId: string): Promise<VoteResponse[]> {
  return apiFetch(`/api/markets/${marketId}/dispute/votes`);
}

// ---------------------------------------------------------------------------
// Community Resolution Votes  –  /api/markets/:id/community-vote(s)
// ---------------------------------------------------------------------------

export function castCommunityVote(
  marketId: string,
  body: CastVoteRequest,
): Promise<CommunityVote> {
  return apiFetch(`/api/markets/${marketId}/community-vote`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function listCommunityVotes(marketId: string): Promise<CommunityVote[]> {
  return apiFetch(`/api/markets/${marketId}/community-votes`);
}

export function listResolutionMarkets(): Promise<Market[]> {
  return apiFetch("/api/markets/resolutions");
}

export function getHotMarkets(limit = 5): Promise<Market[]> {
  return apiFetch(`/api/markets/hot?limit=${limit}`);
}

export function getTrendingMarkets(limit = 3): Promise<Market[]> {
  return apiFetch(`/api/markets/trending?limit=${limit}`);
}

export function getTopMarkets(limit = 3): Promise<Market[]> {
  return apiFetch(`/api/markets/top?limit=${limit}`);
}

// ---------------------------------------------------------------------------
// Bets  –  /api/markets/:id/bets
// ---------------------------------------------------------------------------

export function placeBet(
  marketId: string,
  body: PlaceBetRequest,
): Promise<PlaceBetResponse> {
  return apiFetch(`/api/markets/${marketId}/bets`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function placeMultichoiceBet(
  marketId: string,
  body: PlaceMultichoiceBetRequest,
): Promise<PlaceBetResponse> {
  return apiFetch(`/api/markets/${marketId}/bets/option`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export interface ListBetsParams {
  limit?: number;
  offset?: number;
}

export function listBetsForMarket(
  marketId: string,
  params?: ListBetsParams,
): Promise<Bet[]> {
  const sp = new URLSearchParams();
  if (params?.limit != null) sp.set("limit", String(params.limit));
  if (params?.offset != null) sp.set("offset", String(params.offset));
  const qs = sp.toString();
  return apiFetch(`/api/markets/${marketId}/bets${qs ? `?${qs}` : ""}`);
}

// ---------------------------------------------------------------------------
// Portfolio  –  /api/portfolio, /api/transactions
// ---------------------------------------------------------------------------

export function getPortfolio(): Promise<Bet[]> {
  return apiFetch("/api/portfolio");
}

export interface ListTransactionsParams {
  limit?: number;
  offset?: number;
}

export function getTransactions(
  params?: ListTransactionsParams,
): Promise<Transaction[]> {
  const sp = new URLSearchParams();
  if (params?.limit != null) sp.set("limit", String(params.limit));
  if (params?.offset != null) sp.set("offset", String(params.offset));
  const qs = sp.toString();
  return apiFetch(`/api/transactions${qs ? `?${qs}` : ""}`);
}

// ---------------------------------------------------------------------------
// Leaderboard  –  /api/leaderboard
// ---------------------------------------------------------------------------

export function getLeaderboard(params?: {
  limit?: number;
}): Promise<LeaderboardEntry[]> {
  const sp = new URLSearchParams();
  if (params?.limit != null) sp.set("limit", String(params.limit));
  const qs = sp.toString();
  return apiFetch(`/api/leaderboard${qs ? `?${qs}` : ""}`);
}

export function getWeeklyLeaderboard(
  limit = 10,
): Promise<WeeklyLeaderboardResponse> {
  return apiFetch(`/api/leaderboard/weekly?limit=${limit}`);
}

// ---------------------------------------------------------------------------
// Admin  –  /api/admin
// ---------------------------------------------------------------------------

export function getAdminStats(): Promise<AdminStats> {
  return apiFetch("/api/admin/stats");
}

export function searchUsers(query: string): Promise<UserSearchResult[]> {
  return apiFetch(`/api/admin/users/search?q=${encodeURIComponent(query)}`);
}

export function updateUserRole(
  userId: string,
  role: string,
): Promise<UserSearchResult> {
  return apiFetch(`/api/admin/users/${userId}/role`, {
    method: "PUT",
    body: JSON.stringify({ role }),
  });
}

export function getMarketsForReview(): Promise<{
  pending: Market[];
  approved: Market[];
  denied: Market[];
}> {
  return apiFetch("/api/admin/markets/review");
}

export function reviewMarket(
  marketId: string,
  body: ReviewMarketRequest,
): Promise<unknown> {
  return apiFetch(`/api/admin/markets/${marketId}/review`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function backrollMarket(
  marketId: string,
  body: BackrollRequest,
): Promise<BackrollResponse> {
  return apiFetch(`/api/admin/markets/${marketId}/backroll`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Notifications  –  /api/notifications
// ---------------------------------------------------------------------------

export function listNotifications(params?: {
  limit?: number;
  offset?: number;
}): Promise<NotificationResponse[]> {
  const sp = new URLSearchParams();
  if (params?.limit != null) sp.set("limit", String(params.limit));
  if (params?.offset != null) sp.set("offset", String(params.offset));
  const qs = sp.toString();
  return apiFetch(`/api/notifications${qs ? `?${qs}` : ""}`);
}

export function getUnreadNotificationCount(): Promise<{ count: number }> {
  return apiFetch("/api/notifications/unread-count");
}

export function markNotificationsRead(): Promise<{ status: string }> {
  return apiFetch("/api/notifications/read", { method: "POST" });
}

// ---------------------------------------------------------------------------
// Rewards  –  /api/rewards
// ---------------------------------------------------------------------------

export function getUserRewards(): Promise<RewardsResponse> {
  return apiFetch("/api/rewards");
}

export function getUserBadges(userId: string): Promise<UserBadge[]> {
  return apiFetch(`/api/rewards/badges/${userId}`);
}

export function checkBadges(): Promise<{ new_badges: unknown[] }> {
  return apiFetch("/api/rewards/check", { method: "POST" });
}
