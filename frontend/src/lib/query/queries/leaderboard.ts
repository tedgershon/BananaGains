import { queryOptions } from "@tanstack/react-query";
import * as api from "@/lib/api";
import { queryKeys } from "../keys";
import { STALE } from "../staleTimes";

export const leaderboardQuery = (params?: { limit?: number }) =>
  queryOptions({
    queryKey: queryKeys.leaderboard(params),
    queryFn: () => api.getLeaderboard(params),
    staleTime: STALE.LEADERBOARD,
  });

export const weeklyLeaderboardQuery = (limit?: number) =>
  queryOptions({
    queryKey: queryKeys.weeklyLeaderboard(limit),
    queryFn: () => api.getWeeklyLeaderboard(limit),
    staleTime: STALE.LEADERBOARD,
  });

export const badgesQuery = (userId: string) =>
  queryOptions({
    queryKey: queryKeys.badges(userId),
    queryFn: () => api.getUserBadges(userId),
    staleTime: STALE.REWARDS,
  });
