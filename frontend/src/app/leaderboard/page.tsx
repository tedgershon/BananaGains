import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query/client";
import { leaderboardQuery } from "@/lib/query/queries/leaderboard";
import LeaderboardClient from "./leaderboard-client";

// prefetches the full leaderboard so the rank list shows up immediately
// badge queries are still client-side since they're per-user and lazy
// prefetch failures are swallowed — client refetches on mount
export default async function LeaderboardPage() {
  const qc = getQueryClient();
  await Promise.allSettled([qc.prefetchQuery(leaderboardQuery())]);
  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <LeaderboardClient />
    </HydrationBoundary>
  );
}
