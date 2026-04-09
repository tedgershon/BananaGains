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

function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) {
    return (
      <div
        className={`flex size-5 items-center justify-center rounded-full text-white text-[10px] font-bold ${
          rank === 1
            ? "bg-yellow-500"
            : rank === 2
              ? "bg-gray-400"
              : "bg-amber-700"
        }`}
      >
        <Trophy size={10} />
      </div>
    );
  }
  return (
    <div className="flex size-5 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
      {rank}
    </div>
  );
}

function UserAvatar({
  displayName,
  avatarUrl,
  rank,
}: {
  displayName: string;
  avatarUrl: string | null;
  rank: number;
}) {
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="relative shrink-0">
      <div className="flex size-10 items-center justify-center overflow-hidden rounded-full border-2 border-border bg-muted text-sm font-medium text-muted-foreground">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="size-full object-cover" />
        ) : (
          initials
        )}
      </div>
      <div className="absolute -bottom-1 -right-1">
        <RankBadge rank={rank} />
      </div>
    </div>
  );
}

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
          Who's got the biggest bunch? See who's ruling the banana republic
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
                  <UserAvatar
                    displayName={entry.display_name}
                    avatarUrl={entry.avatar_url}
                    rank={rank}
                  />

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
