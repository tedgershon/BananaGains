"use client";

import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { BananaCoin } from "@/components/banana-coin";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { getLeaderboard } from "@/lib/api";
import { useSession } from "@/lib/SessionProvider";
import type { LeaderboardEntry } from "@/lib/types";

export default function LeaderboardPage() {
  const { user } = useSession();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLeaderboard()
      .then((data) =>
        setEntries(data.sort((a, b) => b.banana_balance - a.banana_balance)),
      )
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
        <div className="flex justify-center py-12"><Spinner className="size-6" /></div>
      ) : (
        <Card size="sm" className="!gap-0 !py-0">
          <CardContent className="divide-y divide-border !p-0">
            {entries.map((entry, i) => {
              const rank = i + 1;
              const isCurrentUser = entry.id === user.id;

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

                  <div className="flex-1">
                    <p className="text-sm font-semibold leading-snug">
                      {entry.display_name}
                      {isCurrentUser && (
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                          (you)
                        </span>
                      )}
                    </p>
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
