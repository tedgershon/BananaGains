"use client";

import { Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { BadgeCircle } from "@/components/badge";
import { BananaCoin } from "@/components/banana-coin";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { getLeaderboard, getUserBadges } from "@/lib/api";
import { useSession } from "@/lib/SessionProvider";
import type { LeaderboardEntry, UserBadge } from "@/lib/types";

export default function LeaderboardPage() {
  const { user } = useSession();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [badgeMap, setBadgeMap] = useState<Record<string, UserBadge[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLeaderboard()
      .then((data) => {
        const sorted = data.sort((a, b) => b.banana_balance - a.banana_balance);
        setEntries(sorted);

        Promise.all(
          sorted.map((entry) =>
            getUserBadges(entry.id).then((badges) => ({
              id: entry.id,
              badges,
            })),
          ),
        )
          .then((results) => {
            const map: Record<string, UserBadge[]> = {};
            for (const r of results) {
              map[r.id] = r.badges;
            }
            setBadgeMap(map);
          })
          .catch(() => {});
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <section className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Leaderboard</h1>
        <p className="text-sm text-muted-foreground">
          Top banana holders on BananaGains
        </p>
      </section>

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner className="size-6" />
        </div>
      ) : (
        <Card size="sm" className="!gap-0 !py-0">
          <CardContent className="divide-y divide-border !p-0">
            {entries.map((entry, i) => {
              const rank = i + 1;
              const isCurrentUser = entry.id === user.id;
              const userBadges = badgeMap[entry.id] ?? [];

              return (
                <div
                  key={entry.id}
                  className={`flex items-center gap-4 px-5 py-3 ${isCurrentUser ? "bg-primary/5" : ""}`}
                >
                  <span className="flex w-8 shrink-0 items-center justify-center text-lg font-bold text-muted-foreground">
                    {rank <= 3 ? (
                      <Trophy
                        className={
                          rank === 1
                            ? "text-yellow-500"
                            : rank === 2
                              ? "text-gray-400"
                              : "text-amber-700"
                        }
                        size={20}
                      />
                    ) : (
                      rank
                    )}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold leading-snug truncate">
                        {entry.display_name}
                        {isCurrentUser && (
                          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                            (you)
                          </span>
                        )}
                      </p>
                      {userBadges.length > 0 && (
                        <div className="flex items-center gap-1">
                          {userBadges.map((badge) => (
                            <BadgeCircle key={badge.track} badge={badge} />
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {entry.andrew_id}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 text-base font-semibold">
                    <BananaCoin size={16} />
                    {entry.banana_balance.toLocaleString()}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
