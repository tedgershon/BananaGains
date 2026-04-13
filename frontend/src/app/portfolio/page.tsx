"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { BananaCoin } from "@/components/banana-coin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useClaimDaily } from "@/lib/query/mutations/auth";
import { useMe } from "@/lib/query/queries/auth";
import { marketsQuery } from "@/lib/query/queries/markets";
import {
  portfolioQuery,
  transactionsQuery,
} from "@/lib/query/queries/portfolio";
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
  const { user } = useMe();
  const { data: markets = [] } = useQuery(marketsQuery());
  const { data: bets = [], isLoading: betsLoading } = useQuery(
    portfolioQuery(),
  );
  const { data: transactions = [], isLoading: txsLoading } = useQuery(
    transactionsQuery(),
  );
  // pending/denied live in the same markets endpoint with a filter, no extra
  // effect or abort controller needed — RQ handles both
  const { data: pendingMarkets = [] } = useQuery(
    marketsQuery({ status: "pending_review" }),
  );
  const { data: deniedMarkets = [] } = useQuery(
    marketsQuery({ status: "denied" }),
  );

  const claim = useClaimDaily();
  const [claimError, setClaimError] = useState<string | null>(null);

  const loading = betsLoading || txsLoading;

  async function handleClaim() {
    setClaimError(null);
    try {
      await claim.mutateAsync();
    } catch (err) {
      if (
        err &&
        typeof err === "object" &&
        "status" in err &&
        (err as { status: number }).status === 409
      ) {
        setClaimError("Already claimed today!");
      } else {
        setClaimError("Failed to claim. Try again later.");
      }
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
        <div className="flex justify-center py-12">
          <Spinner className="size-6" />
        </div>
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

      <div className="grid gap-4 lg:grid-cols-[1fr_2fr] items-start">
        <Card size="sm">
          <CardContent className="divide-y divide-border !p-0">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-muted-foreground">Balance</span>
              <span className="flex items-center gap-1.5 text-lg font-bold">
                <BananaCoin size={18} />
                {user.banana_balance.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-muted-foreground">Active Bets</span>
              <span className="flex items-center gap-1.5 text-lg font-bold">
                <BananaCoin size={18} />
                {activeBets.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-muted-foreground">Positions</span>
              <span className="text-lg font-bold">{userBets.length}</span>
            </div>
            {!user.above_cap && (
              <div className="px-4 py-3">
                {claimError && (
                  <p className="text-xs text-destructive mb-2">{claimError}</p>
                )}
                {user.claimed_today && user.banana_balance <= 5000 ? (
                  <p className="text-xs text-muted-foreground">
                    Claimed! Come back tomorrow.
                  </p>
                ) : (
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={handleClaim}
                    disabled={claim.isPending}
                  >
                    {claim.isPending ? (
                      <Spinner />
                    ) : user.claim_amount < 1000 ? (
                      `Claim ${user.claim_amount.toLocaleString()} Daily Bananas`
                    ) : (
                      "Claim 1,000 Daily Bananas"
                    )}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Positions</h2>
          <div className="grid gap-2 max-h-[400px] overflow-y-auto p-1 -m-1">
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

      {(pendingMarkets.length > 0 || deniedMarkets.length > 0) && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Pending Markets</h2>
          <div className="grid gap-2">
            {pendingMarkets.map((market) => (
              <Card key={market.id} size="sm">
                <CardContent className="flex items-center justify-between">
                  <div className="flex-1 space-y-0.5">
                    <p className="text-sm font-medium leading-snug">
                      {market.title}
                    </p>
                    <Badge
                      variant="outline"
                      className="border-amber-500 text-amber-500"
                    >
                      Pending Review
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
            {deniedMarkets.map((market) => (
              <Card key={market.id} size="sm">
                <CardContent className="flex items-center justify-between">
                  <div className="flex-1 space-y-0.5">
                    <p className="text-sm font-medium leading-snug">
                      {market.title}
                    </p>
                    <div className="space-y-1">
                      <Badge variant="destructive">Denied</Badge>
                      {market.review_notes && (
                        <p className="text-xs text-muted-foreground">
                          {market.review_notes}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

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
