"use client";

import { HottestMarketDisplay } from "@/components/hottest-market";
import { TrendingTopMarkets } from "@/components/trending-markets";
import { WeeklyLeaderboard } from "@/components/weekly-leaderboard";

export default function Home() {
  return (
    <div className="mt-2 space-y-8">
      <HottestMarketDisplay />

      <div className="grid gap-8 lg:grid-cols-2">
        <WeeklyLeaderboard />
        <TrendingTopMarkets />
      </div>
    </div>
  );
}
