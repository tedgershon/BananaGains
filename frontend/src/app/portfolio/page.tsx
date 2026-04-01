"use client";

import Link from "next/link";
import { useState } from "react";
import { BananaCoin } from "@/components/banana-coin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useData } from "@/lib/DataProvider";
import { useSession } from "@/lib/SessionProvider";
import { getMarketProbability } from "@/lib/types";

const TX_LABELS: Record<string, string> = {
  initial_grant: "Initial Grant",
  bet_placement: "Bet Placed",
  payout: "Payout",
  voter_stake: "Voter Stake",
  voter_reward: "Voter Reward",
  daily_claim: "Daily Claim",
};

export default function PortfolioPage() {
  const { user } = useSession();
  const { markets, bets, transactions, loading, claimDaily } = useData();
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  async function handleClaim() {
    setClaiming(true);
    setClaimError(null);
    try {
      await claimDaily();
    } catch (err) {
      if (err && typeof err === "object" && "status" in err && (err as { status: number }).status === 409) {
        setClaimError("Already claimed today!");
      } else {
        setClaimError("Failed to claim. Try again later.");
      }
    } finally {
      setClaiming(false);
    }
  }

  function getMarketById(id: string) {
    return markets.find((m) => m.id === id);
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <section>
          <h1 className="text-3xl font-bold tracking-tight">Portfolio</h1>
        </section>
        <div className="flex justify-center py-12"><Spinner className="size-6" /></div>
      </div>
    );
  }

  const userBets = bets.filter((b) => b.user_id === user.id);
  const userTxs = transactions
    .filter((t) => t.user_id === user.id)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

  const activeBets = userBets.reduce((sum, b) => sum + b.amount, 0);

  return (
    <div className="space-y-5">
      <section>
        <h1 className="text-3xl font-bold tracking-tight">Portfolio</h1>
        <p className="text-sm text-muted-foreground">
          {user.display_name} ({user.andrew_id})
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <Card size="sm" className="py-2">
            <CardHeader className="pb-0">
              <span className="text-xs text-muted-foreground">Balance</span>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-3xl font-bold">
                <BananaCoin size={28} />
                {user.banana_balance.toLocaleString()}
              </div>
              {user.claimed_today ? (
                <p className="text-xs text-muted-foreground">
                  {claimError || "Claimed! Come back tomorrow."}
                </p>
              ) : (
                <Button
                  size="sm"
                  className="w-full"
                  onClick={handleClaim}
                  disabled={claiming}
                >
                  {claiming ? <Spinner /> : "Claim 1,000 Daily Bananas"}
                </Button>
              )}
            </CardContent>
          </Card>

          <Card size="sm" className="py-2">
            <CardHeader className="pb-0">
              <span className="text-xs text-muted-foreground">Active Bets</span>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-3xl font-bold">
                <BananaCoin size={28} />
                {activeBets.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card size="sm" className="py-2">
            <CardHeader className="pb-0">
              <span className="text-xs text-muted-foreground">
                Active Positions
              </span>
            </CardHeader>
            <CardContent>
              <span className="text-3xl font-bold">{userBets.length}</span>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Positions</h2>
          <div className="grid gap-2">
            {userBets.map((bet) => {
              const market = getMarketById(bet.market_id);
              if (!market) return null;
              const prob = getMarketProbability(market);

              return (
                <Link key={bet.id} href={`/markets/${bet.market_id}`}>
                  <Card size="sm">
                    <CardContent className="flex items-center justify-between">
                      <div className="flex-1 space-y-0.5">
                        <p className="text-sm font-medium leading-snug">
                          {market.title}
                        </p>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={bet.side === "YES" ? "default" : "outline"}
                            className={
                              bet.side === "YES"
                                ? "bg-success-foreground text-success"
                                : "bg-danger-foreground text-danger"
                            }
                          >
                            {bet.side}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {prob}% chance
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-base font-semibold">
                        <BananaCoin size={16} />
                        {bet.amount.toLocaleString()}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Transaction History</h2>
        <Card size="sm" className="!gap-0 !py-0">
          <CardContent className="divide-y divide-border !p-0">
            {userTxs.map((tx) => {
              const market = tx.market_id ? getMarketById(tx.market_id) : null;
              const isPositive = tx.amount > 0;

              return (
                <div
                  key={tx.id}
                  className="flex items-center justify-between px-4 py-2"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {TX_LABELS[tx.transaction_type] ?? tx.transaction_type}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {market ? market.title : "Account"}
                      {" · "}
                      {new Date(tx.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  <span
                    className={`flex items-center gap-0.5 text-sm font-semibold ${isPositive ? "text-success" : "text-danger"}`}
                  >
                    {isPositive ? "+" : ""}
                    <BananaCoin size={14} />
                    {Math.abs(tx.amount).toLocaleString()}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
