"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { BananaCoin } from "@/components/banana-coin";
import { ProbabilityChart } from "@/components/probability-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import * as api from "@/lib/api";
import { useData } from "@/lib/DataProvider";
import { useSession } from "@/lib/SessionProvider";
import type { Bet, BetSide, DisputeResponse, PricePoint } from "@/lib/types";
import { getMarketProbability } from "@/lib/types";

function buildPriceHistory(bets: Bet[]): PricePoint[] {
  if (bets.length === 0) return [];

  const sorted = [...bets].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  let yes = 0;
  let no = 0;
  const points: PricePoint[] = [];

  for (const bet of sorted) {
    if (bet.side === "YES") yes += bet.amount;
    else no += bet.amount;
    const total = yes + no;
    points.push({
      timestamp: bet.created_at,
      probability: total > 0 ? Math.round((yes / total) * 100) : 50,
    });
  }

  return points;
}

export default function MarketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const {
    markets,
    bets: userBets,
    placeBet,
    fetchMarket,
    resolveMarket,
    disputeMarket,
    castDisputeVote,
  } = useData();
  const { user } = useSession();

  const contextMarket = markets.find((m) => m.id === id);
  const [fetchedMarket, setFetchedMarket] = useState<typeof contextMarket>();
  const [marketBets, setMarketBets] = useState<Bet[]>([]);
  const [betsLoading, setBetsLoading] = useState(true);

  const market = contextMarket ?? fetchedMarket;

  useEffect(() => {
    if (!contextMarket) {
      fetchMarket(id)
        .then(setFetchedMarket)
        .catch(() => {});
    }
  }, [id, contextMarket, fetchMarket]);

  useEffect(() => {
    setBetsLoading(true);
    api
      .listBetsForMarket(id)
      .then(setMarketBets)
      .catch(() => {})
      .finally(() => setBetsLoading(false));
  }, [id]);

  const [betAmount, setBetAmount] = useState("");
  const [betError, setBetError] = useState<string | null>(null);
  const [betSuccess, setBetSuccess] = useState<string | null>(null);
  const [betting, setBetting] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [disputing, setDisputing] = useState(false);
  const [voting, setVoting] = useState(false);
  const [disputeExplanation, setDisputeExplanation] = useState("");
  const [disputeDetails, setDisputeDetails] = useState<DisputeResponse | null>(
    null,
  );
  const [voteTotals, setVoteTotals] = useState<{ yes: number; no: number }>({
    yes: 0,
    no: 0,
  });

  const refreshVoteTotals = useCallback(async () => {
    try {
      const votes = await api.listDisputeVotes(id);
      let yes = 0;
      let no = 0;
      for (const vote of votes) {
        if (vote.selected_outcome === "YES") yes += 1;
        else if (vote.selected_outcome === "NO") no += 1;
      }
      setVoteTotals({ yes, no });
    } catch {
      // ignore
    }
  }, [id]);

  useEffect(() => {
    if (market?.status === "disputed") {
      api
        .getDispute(id)
        .then(setDisputeDetails)
        .catch(() => {
          setDisputeDetails(null);
        });
      refreshVoteTotals();
    }
  }, [market?.status, refreshVoteTotals]);

  if (!market) {
    return (
      <div className="space-y-4 py-12 text-center">
        <h1 className="text-2xl font-bold">Market not found</h1>
        <Link href="/" className="text-primary underline">
          Back to markets
        </Link>
      </div>
    );
  }

  const probability = getMarketProbability(market);
  const total = market.yes_pool_total + market.no_pool_total;
  const chartData = buildPriceHistory(marketBets);
  const isOpen = market.status === "open";
  const isPendingResolution = market.status === "pending_resolution";
  const isDisputed = market.status === "disputed";
  const userHasBet = userBets.some((bet) => bet.market_id === market.id);
  const votingEndsAt = disputeDetails?.voting_deadline
    ? new Date(disputeDetails.voting_deadline)
    : null;
  const votingClosed = votingEndsAt ? votingEndsAt <= new Date() : false;
  const disputeDeadline = market.dispute_deadline
    ? new Date(market.dispute_deadline)
    : null;

  async function handleBet(side: BetSide) {
    if (!market) return;
    setBetError(null);
    setBetSuccess(null);
    const amount = Number(betAmount);
    if (!betAmount || Number.isNaN(amount) || amount <= 0) {
      setBetError("Enter a valid positive amount.");
      return;
    }
    if (amount > user.banana_balance) {
      setBetError("Insufficient banana balance.");
      return;
    }
    setBetting(true);
    try {
      await placeBet(market.id, side, amount);
      setBetSuccess(`Placed ${amount} on ${side}!`);
      setBetAmount("");
      api
        .listBetsForMarket(id)
        .then(setMarketBets)
        .catch(() => {});
    } catch (err) {
      setBetError(err instanceof Error ? err.message : "Failed to place bet.");
    } finally {
      setBetting(false);
    }
  }

  async function handleResolve(outcome: BetSide) {
    if (!market) return;
    if (
      !confirm(
        `Are you sure you want to propose ${outcome} as the resolution? This opens a dispute window.`,
      )
    )
      return;
    setResolving(true);
    setBetError(null);
    setBetSuccess(null);
    try {
      await resolveMarket(market.id, outcome);
      setBetSuccess(`Resolution proposed as ${outcome}. Dispute window open.`);
      // Update local bets/history
      api.listBetsForMarket(id).then(setMarketBets);
    } catch (err) {
      setBetError(
        err instanceof Error ? err.message : "Failed to resolve market.",
      );
    } finally {
      setResolving(false);
    }
  }

  async function handleDispute() {
    if (!market) return;
    const explanation = disputeExplanation.trim();
    if (!explanation) {
      setBetError("Please add a short explanation for the dispute.");
      return;
    }
    setDisputing(true);
    setBetError(null);
    setBetSuccess(null);
    try {
      await disputeMarket(market.id, explanation);
      setDisputeExplanation("");
      setBetSuccess("Market disputed. Voting is now open.");
    } catch (err) {
      setBetError(
        err instanceof Error ? err.message : "Failed to dispute market.",
      );
    } finally {
      setDisputing(false);
    }
  }

  async function handleVote(outcome: BetSide) {
    if (!market) return;
    setBetError(null);
    setBetSuccess(null);
    if (userHasBet) {
      setBetError("Bettors cannot vote in disputes.");
      return;
    }
    setVoting(true);
    try {
      await castDisputeVote(market.id, outcome);
      setBetSuccess(`Voted ${outcome}.`);
      refreshVoteTotals();
    } catch (err) {
      setBetError(
        err instanceof Error ? err.message : "Failed to submit vote.",
      );
    } finally {
      setVoting(false);
    }
  }


  const closesAt = new Date(market.close_at).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="space-y-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to markets
      </Link>

      <div className="space-y-1">
        <div className="flex items-center gap-2">
          {isOpen ? (
            <span className="glimmer-dot size-2.5 rounded-full bg-success" />
          ) : (
            <span className="size-2.5 rounded-full bg-muted-foreground/40" />
          )}
          <Badge variant="outline">{market.category}</Badge>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{market.title}</h1>
        <p className="text-sm text-muted-foreground">{market.description}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <Card size="sm">
            <CardHeader className="flex flex-row items-center justify-between pb-0">
              <span className="text-sm font-medium">Probability</span>
              <span className="text-2xl font-bold text-success">
                {probability}%
              </span>
            </CardHeader>
            <CardContent>
              {chartData.length > 1 ? (
                <ProbabilityChart data={chartData} />
              ) : (
                <div className="flex h-[280px] items-center justify-center text-muted-foreground">
                  Not enough activity for a chart yet
                </div>
              )}
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader className="pb-0">
              <span className="text-sm font-medium">Market Info</span>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Status</dt>
                <dd className="font-medium capitalize">{market.status}</dd>
                {isDisputed && votingEndsAt && (
                  <>
                    <dt className="text-muted-foreground">Voting ends</dt>
                    <dd className="font-medium">
                      {votingEndsAt.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </dd>
                  </>
                )}
                <dt className="text-muted-foreground">Closes</dt>
                <dd className="font-medium">{closesAt}</dd>
                <dt className="text-muted-foreground">Total Pool</dt>
                <dd className="inline-flex items-center gap-0.5 font-medium">
                  <BananaCoin size={14} />
                  {total.toLocaleString()}
                </dd>
                <dt className="text-muted-foreground">Yes Pool</dt>
                <dd className="inline-flex items-center gap-0.5 font-medium text-success">
                  <BananaCoin size={14} />
                  {market.yes_pool_total.toLocaleString()}
                </dd>
                <dt className="text-muted-foreground">No Pool</dt>
                <dd className="inline-flex items-center gap-0.5 font-medium text-danger">
                  <BananaCoin size={14} />
                  {market.no_pool_total.toLocaleString()}
                </dd>
                <dt className="text-muted-foreground">Resolution</dt>
                <dd className="col-span-1 font-medium">
                  {market.resolution_criteria}
                </dd>
              </dl>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card size="sm">
            <CardHeader className="pb-0">
              <span className="text-sm font-medium">Place a Bet</span>
            </CardHeader>
            <CardContent className="space-y-3">
              {betError && (
                <p className="text-xs font-medium text-danger">{betError}</p>
              )}
              {betSuccess && (
                <p className="text-xs font-medium text-success">{betSuccess}</p>
              )}

              {isOpen ? (
                <>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    Your balance: <BananaCoin size={12} />
                    <span className="font-medium text-foreground">
                      {user.banana_balance.toLocaleString()}
                    </span>
                  </div>
                  <input
                    type="number"
                    placeholder="Amount"
                    min={1}
                    value={betAmount}
                    onChange={(e) => {
                      setBetAmount(e.target.value);
                      setBetError(null);
                      setBetSuccess(null);
                    }}
                    className="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      className="h-14 text-base bg-success text-success-foreground border-b-success/40 active:border-b-success/40 hover:bg-success/80"
                      onClick={() => handleBet("YES")}
                      disabled={betting}
                    >
                      Yes {probability}%
                    </Button>
                    <Button
                      className="h-14 text-base bg-danger text-danger-foreground border-b-danger/40 active:border-b-danger/40 hover:bg-danger/80"
                      onClick={() => handleBet("NO")}
                      disabled={betting}
                    >
                      No {100 - probability}%
                    </Button>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    This market is {market.status} and no longer accepting bets.
                  </p>

                  {market.status === "closed" &&
                    user.id === market.creator_id && (
                      <div className="space-y-2 mt-4 pt-4 border-t">
                        <p className="text-sm font-medium">
                          Resolve Market Outcomes
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            variant="outline"
                            className="h-10 text-success border-success hover:bg-success hover:text-success-foreground"
                            onClick={() => handleResolve("YES")}
                            disabled={resolving}
                          >
                            Resolve YES
                          </Button>
                          <Button
                            variant="outline"
                            className="h-10 text-danger border-danger hover:bg-danger hover:text-danger-foreground"
                            onClick={() => handleResolve("NO")}
                            disabled={resolving}
                          >
                            Resolve NO
                          </Button>
                        </div>
                      </div>
                    )}

                  {isPendingResolution && (
                    <div className="space-y-3 mt-4 pt-4 border-t">
                      <p className="text-sm font-medium">Dispute Resolution</p>
                      <div className="text-xs text-muted-foreground">
                        Provide a short explanation if you want to dispute the
                        proposed outcome.
                      </div>
                      {disputeDeadline && (
                        <div className="text-xs text-muted-foreground">
                          Dispute window ends on {" "}
                          {disputeDeadline.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                          .
                        </div>
                      )}
                      <textarea
                        value={disputeExplanation}
                        onChange={(e) => {
                          setDisputeExplanation(e.target.value);
                          setBetError(null);
                          setBetSuccess(null);
                        }}
                        placeholder="Why are you disputing this outcome?"
                        className="w-full min-h-[90px] rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={handleDispute}
                        disabled={disputing}
                      >
                        {disputing ? "Submitting dispute..." : "Submit Dispute"}
                      </Button>
                    </div>
                  )}

                  {isDisputed && (
                    <div className="space-y-3 mt-4 pt-4 border-t">
                      <p className="text-sm font-medium">Community Vote</p>
                      <div className="text-xs text-muted-foreground">
                        {userHasBet
                          ? "Bettors cannot vote in disputes."
                          : "Cast your vote on the final outcome."}
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span>YES votes: {voteTotals.yes}</span>
                        <span>NO votes: {voteTotals.no}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          className="h-10 text-sm bg-success text-success-foreground hover:bg-success/80"
                          onClick={() => handleVote("YES")}
                          disabled={voting || userHasBet || votingClosed}
                        >
                          Vote YES
                        </Button>
                        <Button
                          className="h-10 text-sm bg-danger text-danger-foreground hover:bg-danger/80"
                          onClick={() => handleVote("NO")}
                          disabled={voting || userHasBet || votingClosed}
                        >
                          Vote NO
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-2">
            <span className="text-sm font-medium">Recent Activity</span>
            {betsLoading ? (
              <div className="flex justify-center py-4"><Spinner className="size-5" /></div>
            ) : marketBets.length > 0 ? (
              <div className="space-y-2">
                {marketBets.map((bet) => (
                  <div
                    key={bet.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={
                          bet.side === "YES"
                            ? "bg-success-foreground text-success"
                            : "bg-danger-foreground text-danger"
                        }
                      >
                        {bet.side}
                      </Badge>
                      <span className="text-muted-foreground">
                        {new Date(bet.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-0.5 font-medium">
                      <BananaCoin size={14} />
                      {bet.amount.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
