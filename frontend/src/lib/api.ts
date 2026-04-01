import { supabase } from "./supabase";
import type {
  Bet,
  ClaimDailyResponse,
  CreateMarketRequest,
  CreateProfileRequest,
  LeaderboardEntry,
  Market,
  PlaceBetRequest,
  PlaceBetResponse,
  ResolveMarketRequest,
  ResolveMarketResponse,
  Transaction,
  UserProfile,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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

  if (!res.ok) {
    throw new ApiError(res.status, await res.text());
  }
  return res.json();
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
