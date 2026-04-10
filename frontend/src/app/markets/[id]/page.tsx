"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  ExternalLink,
  Timer,
  X,
} from "lucide-react";
import Link from "next/link";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { BananaCoin } from "@/components/banana-coin";
import {
  buildMultiOptionPriceHistory,
  getOptionColor,
  MultiProbabilityChart,
  ProbabilityChart,
} from "@/components/probability-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import * as api from "@/lib/api";
import { useData } from "@/lib/DataProvider";
import { useSession } from "@/lib/SessionProvider";
import type {
  Bet,
  BetSide,
  CommunityVote,
  DisputeResponse,
  MarketOption,
  PricePoint,
} from "@/lib/types";
import { getMarketProbability } from "@/lib/types";
import { cn } from "@/lib/utils";

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
    placeMultichoiceBet,
    fetchMarket,
    resolveMarket,
    disputeMarket,
    castDisputeVote,
  } = useData();
  const { user, isDemo } = useSession();

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
  const [communityTally, setCommunityTally] = useState<{
    yes: number;
    no: number;
  }>({ yes: 0, no: 0 });
  const [userCommunityVote, setUserCommunityVote] = useState<string | null>(
    null,
  );
  const [communityVoting, setCommunityVoting] = useState(false);
  const [communityError, setCommunityError] = useState<string | null>(null);
  const [resolutionCountdown, setResolutionCountdown] = useState("");
  const [resolutionUrgent, setResolutionUrgent] = useState(false);
  const [backrollDate, setBackrollDate] = useState("");
  const [backrollClose, setBackrollClose] = useState(true);
  const [backrolling, setBackrolling] = useState(false);
  const [backrollResult, setBackrollResult] = useState<string | null>(null);
  const [backrollError, setBackrollError] = useState<string | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [showAllOptions, setShowAllOptions] = useState(false);
  const [chartOptionDropdownOpen, setChartOptionDropdownOpen] = useState(false);
  const [visibleOptionIds, setVisibleOptionIds] = useState<string[]>([]);

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

  const refreshCommunityVotes = useCallback(async () => {
    try {
      const votes: CommunityVote[] = await api.listCommunityVotes(id);
      let yes = 0;
      let no = 0;
      for (const v of votes) {
        if (v.selected_outcome === "YES") yes++;
        else no++;
      }
      setCommunityTally({ yes, no });
      const existing = votes.find((v) => v.voter_id === user.id);
      if (existing) setUserCommunityVote(existing.selected_outcome);
    } catch {
      // ignore
    }
  }, [id, user.id]);

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
  }, [market?.status, refreshVoteTotals, id]);

  useEffect(() => {
    const inResolution =
      market?.status === "closed" || market?.status === "pending_resolution";
    if (inResolution && market?.resolution_window_end) {
      refreshCommunityVotes();
    }
  }, [market?.status, market?.resolution_window_end, refreshCommunityVotes]);

  useEffect(() => {
    const end = market?.resolution_window_end;
    if (!end) return;
    function tick() {
      const diff = new Date(end as string).getTime() - Date.now();
      if (diff <= 0) {
        setResolutionCountdown("Expired");
        setResolutionUrgent(false);
        return;
      }
      const hours = Math.floor(diff / 3_600_000);
      const minutes = Math.floor((diff % 3_600_000) / 60_000);
      const seconds = Math.floor((diff % 60_000) / 1_000);
      setResolutionUrgent(hours < 1);
      setResolutionCountdown(
        hours > 0
          ? `${hours}h ${minutes}m ${seconds}s`
          : `${minutes}m ${seconds}s`,
      );
    }
    tick();
    const interval = setInterval(tick, 1_000);
    return () => clearInterval(interval);
  }, [market?.resolution_window_end]);

  const isMultichoice = market?.market_type === "multichoice";
  const marketOptions = market?.options ?? [];
  const mcTotalPool = marketOptions.reduce((s, o) => s + o.pool_total, 0);
  const sortedOptions = useMemo(
    () => [...marketOptions].sort((a, b) => b.pool_total - a.pool_total),
    [marketOptions],
  );
  const multiChartData = useMemo(
    () =>
      isMultichoice
        ? buildMultiOptionPriceHistory(marketOptions, marketBets)
        : [],
    [isMultichoice, marketOptions, marketBets],
  );

  useEffect(() => {
    if (
      isMultichoice &&
      marketOptions.length > 0 &&
      visibleOptionIds.length === 0
    ) {
      const sorted = [...marketOptions].sort(
        (a, b) => b.pool_total - a.pool_total,
      );
      setVisibleOptionIds(sorted.slice(0, 3).map((o) => o.id));
    }
  }, [isMultichoice, marketOptions, visibleOptionIds.length]);

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
  const hasResolutionWindow =
    (market.status === "closed" || market.status === "pending_resolution") &&
    !!market.resolution_window_end;
  const resolutionWindowExpired = resolutionCountdown === "Expired";
  const isCreator = user.id === market.creator_id;
  const isAdmin = user.role === "admin" || user.role === "super_admin";
  const canBackroll = isAdmin && market.status !== "resolved";
  const voterRewardPool = Math.round(total * 0.04);
  const topOptions = showAllOptions ? sortedOptions : sortedOptions.slice(0, 3);

  function toggleChartOption(optId: string) {
    setVisibleOptionIds((prev) =>
      prev.includes(optId)
        ? prev.filter((id) => id !== optId)
        : [...prev, optId],
    );
  }

  function getOptionPct(opt: MarketOption) {
    return mcTotalPool > 0
      ? Math.round((opt.pool_total / mcTotalPool) * 100)
      : 0;
  }

  async function handleMultichoiceBet(optionId: string) {
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
      await placeMultichoiceBet(market.id, optionId, amount);
      const optLabel =
        marketOptions.find((o) => o.id === optionId)?.label ?? "option";
      setBetSuccess(`Placed ${amount} on ${optLabel}!`);
      setBetAmount("");
      setSelectedOptionId(null);
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

  async function handleBackroll() {
    if (!market || !backrollDate) return;
    if (
      !confirm(
        "This will cancel all bets placed after the specified date and refund those users. This action cannot be undone. Continue?",
      )
    )
      return;
    setBackrolling(true);
    setBackrollError(null);
    setBackrollResult(null);
    try {
      const result = await api.backrollMarket(market.id, {
        cutoff_date: new Date(backrollDate).toISOString(),
        close_market: backrollClose,
      });
      setBackrollResult(
        `Backroll complete: ${result.bets_cancelled} bet(s) cancelled, ${result.total_refunded} banana(s) refunded.`,
      );
      fetchMarket(id)
        .then(setFetchedMarket)
        .catch(() => {});
      api
        .listBetsForMarket(id)
        .then(setMarketBets)
        .catch(() => {});
    } catch (err) {
      setBackrollError(err instanceof Error ? err.message : "Backroll failed.");
    } finally {
      setBackrolling(false);
    }
  }

  async function handleCommunityVote(side: BetSide) {
    if (!market) return;
    setCommunityError(null);
    setCommunityVoting(true);
    try {
      await api.castCommunityVote(market.id, { vote: side });
      setUserCommunityVote(side);
      await refreshCommunityVotes();
    } catch (err) {
      setCommunityError(
        err instanceof Error ? err.message : "Failed to cast vote.",
      );
    } finally {
      setCommunityVoting(false);
    }
  }

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
              {!isMultichoice && (
                <span className="text-2xl font-bold text-success">
                  {probability}%
                </span>
              )}
            </CardHeader>
            <CardContent>
              {isMultichoice ? (
                multiChartData.length > 1 ? (
                  <div className="space-y-2">
                    <MultiProbabilityChart
                      options={marketOptions}
                      data={multiChartData}
                      visibleOptionIds={visibleOptionIds}
                    />
                    <div className="relative">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() =>
                          setChartOptionDropdownOpen(!chartOptionDropdownOpen)
                        }
                      >
                        Showing {visibleOptionIds.length} of{" "}
                        {marketOptions.length} options
                        <ChevronDown className="size-3" />
                      </button>
                      {chartOptionDropdownOpen && (
                        <div className="absolute left-0 top-full z-10 mt-1 w-56 rounded-lg border bg-card p-2 shadow-md">
                          {marketOptions.map((opt, idx) => (
                            <label
                              key={opt.id}
                              className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={visibleOptionIds.includes(opt.id)}
                                onChange={() => toggleChartOption(opt.id)}
                                className="rounded border-border"
                              />
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{
                                  backgroundColor: getOptionColor(idx),
                                }}
                              />
                              <span className="truncate">{opt.label}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex h-[280px] items-center justify-center text-muted-foreground">
                    Not enough activity for a chart yet
                  </div>
                )
              ) : chartData.length > 1 ? (
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
                {isMultichoice && (
                  <>
                    <dt className="text-muted-foreground">Market Type</dt>
                    <dd className="font-medium">
                      Multiple Choice (
                      {market.multichoice_type === "exclusive"
                        ? "Exclusive"
                        : "Non-Exclusive"}
                      )
                    </dd>
                  </>
                )}
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
                  {isMultichoice
                    ? mcTotalPool.toLocaleString()
                    : total.toLocaleString()}
                </dd>
                {isMultichoice ? (
                  <>
                    <dt className="col-span-2 mt-2 text-muted-foreground font-medium">
                      Option Pools
                    </dt>
                    {sortedOptions.map((opt) => (
                      <div
                        key={opt.id}
                        className="col-span-2 flex items-center justify-between"
                      >
                        <span
                          className={cn(
                            "flex items-center gap-1.5 text-sm",
                            market.status === "resolved" &&
                              opt.is_winner === true &&
                              "text-success font-semibold",
                            market.status === "resolved" &&
                              opt.is_winner === false &&
                              "text-muted-foreground line-through",
                          )}
                        >
                          {market.status === "resolved" &&
                            opt.is_winner === true && (
                              <Check className="size-3.5 text-success" />
                            )}
                          {market.status === "resolved" &&
                            opt.is_winner === false && (
                              <X className="size-3.5 text-danger" />
                            )}
                          {opt.label}
                        </span>
                        <span className="inline-flex items-center gap-1 text-sm font-medium">
                          <BananaCoin size={14} />
                          {opt.pool_total.toLocaleString()}
                          <span className="text-xs text-muted-foreground">
                            ({getOptionPct(opt)}%)
                          </span>
                        </span>
                      </div>
                    ))}
                  </>
                ) : (
                  <>
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
                  </>
                )}
                {hasResolutionWindow && (
                  <>
                    <dt className="text-muted-foreground">Voter Reward Pool</dt>
                    <dd className="inline-flex items-center gap-0.5 font-medium">
                      <BananaCoin size={14} />
                      {voterRewardPool.toLocaleString()}
                    </dd>
                  </>
                )}
                <dt className="text-muted-foreground">Resolution</dt>
                <dd className="col-span-1 font-medium">
                  {market.resolution_criteria}
                </dd>
                {market.link && (
                  <>
                    <dt className="text-muted-foreground">Source Link</dt>
                    <dd className="font-medium">
                      <a
                        href={market.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        <ExternalLink className="size-3.5" />
                        View Source
                      </a>
                    </dd>
                  </>
                )}
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
                isDemo ? (
                  <p className="text-sm text-muted-foreground">
                    Sign in with your CMU email address to place a bet.
                  </p>
                ) : isCreator ? (
                  <p className="text-sm text-muted-foreground">
                    As the market creator, you cannot place bets on this market.
                    You will be able to propose a resolution once the market
                    closes.
                  </p>
                ) : isMultichoice ? (
                  <>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      Your balance: <BananaCoin size={12} />
                      <span className="font-medium text-foreground">
                        {user.banana_balance.toLocaleString()}
                      </span>
                    </div>
                    {selectedOptionId && (
                      <div className="space-y-2">
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
                        <div className="flex gap-2">
                          <Button
                            className="flex-1"
                            onClick={() =>
                              handleMultichoiceBet(selectedOptionId)
                            }
                            disabled={betting}
                          >
                            {betting ? (
                              <Spinner className="size-4" />
                            ) : (
                              `Confirm Bet`
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => setSelectedOptionId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                    <div className="space-y-1.5">
                      {topOptions.map((opt) => {
                        const pct = getOptionPct(opt);
                        const originalIdx = marketOptions.findIndex(
                          (o) => o.id === opt.id,
                        );
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            className={cn(
                              "flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors hover:bg-muted",
                              selectedOptionId === opt.id &&
                                "border-primary ring-2 ring-primary/20",
                            )}
                            onClick={() => {
                              setSelectedOptionId(
                                selectedOptionId === opt.id ? null : opt.id,
                              );
                              setBetError(null);
                              setBetSuccess(null);
                            }}
                          >
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{
                                backgroundColor: getOptionColor(originalIdx),
                              }}
                            />
                            <span className="flex-1 text-left font-medium truncate">
                              {opt.label}
                            </span>
                            <span className="text-muted-foreground">
                              {pct}%
                            </span>
                          </button>
                        );
                      })}
                      {sortedOptions.length > 3 && (
                        <button
                          type="button"
                          className="w-full text-center text-xs text-primary hover:underline py-1"
                          onClick={() => setShowAllOptions(!showAllOptions)}
                        >
                          {showAllOptions
                            ? "Show fewer options"
                            : `Show all ${sortedOptions.length} options`}
                        </button>
                      )}
                    </div>
                  </>
                ) : (
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
                )
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    This market is {market.status} and no longer accepting bets.
                  </p>

                  {hasResolutionWindow && (
                    <div className="space-y-3 mt-4 pt-4 border-t">
                      <p className="text-sm font-medium">
                        Community Resolution
                      </p>

                      {/* Creator's Call */}
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">
                          Creator&apos;s Call:
                        </span>
                        {market.proposed_outcome ? (
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-xs font-semibold",
                              market.proposed_outcome === "YES"
                                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
                            )}
                          >
                            {market.proposed_outcome}
                          </span>
                        ) : (
                          <span className="italic text-muted-foreground">
                            Undecided
                          </span>
                        )}
                      </div>

                      {/* Countdown */}
                      <div className="flex items-center gap-2 text-sm">
                        <Timer className="size-4 text-muted-foreground" />
                        <span
                          className={cn(
                            "font-medium",
                            resolutionUrgent && "text-danger",
                          )}
                        >
                          {resolutionWindowExpired
                            ? "Expired"
                            : `Resolves in ${resolutionCountdown}`}
                        </span>
                      </div>

                      {/* Vote tally */}
                      <div className="flex items-center justify-between text-xs">
                        <span>YES votes: {communityTally.yes}</span>
                        <span>NO votes: {communityTally.no}</span>
                      </div>

                      {/* Reward hint */}
                      <p className="text-xs text-muted-foreground">
                        Earn ~
                        {communityTally.yes + communityTally.no > 0
                          ? Math.round(
                              voterRewardPool /
                                (communityTally.yes + communityTally.no),
                            ).toLocaleString()
                          : voterRewardPool.toLocaleString()}{" "}
                        bananas for voting correctly
                      </p>

                      {/* Vote buttons or status */}
                      {isCreator ? (
                        <p className="text-xs italic text-muted-foreground">
                          As the market creator, you propose a resolution via
                          the Creator Resolution section below.
                        </p>
                      ) : userCommunityVote ? (
                        <p className="text-xs font-medium text-muted-foreground">
                          You voted {userCommunityVote}
                        </p>
                      ) : resolutionWindowExpired ? (
                        <p className="text-xs italic text-muted-foreground">
                          Resolution window has expired
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {communityError && (
                            <p className="text-xs font-medium text-danger">
                              {communityError}
                            </p>
                          )}
                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              size="sm"
                              className="bg-success text-success-foreground hover:bg-success/80"
                              onClick={() => handleCommunityVote("YES")}
                              disabled={communityVoting}
                            >
                              Vote YES
                            </Button>
                            <Button
                              size="sm"
                              className="bg-danger text-danger-foreground hover:bg-danger/80"
                              onClick={() => handleCommunityVote("NO")}
                              disabled={communityVoting}
                            >
                              Vote NO
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

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
                          Dispute window ends on{" "}
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
              <div className="flex justify-center py-4">
                <Spinner className="size-5" />
              </div>
            ) : marketBets.length > 0 ? (
              <div className="space-y-2">
                {marketBets.map((bet) => {
                  const optionLabel = bet.option_id
                    ? marketOptions.find((o) => o.id === bet.option_id)?.label
                    : null;
                  return (
                    <div
                      key={bet.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <div className="flex items-center gap-2">
                        {optionLabel ? (
                          <Badge variant="outline">{optionLabel}</Badge>
                        ) : (
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
                        )}
                        <span className="text-muted-foreground">
                          {new Date(bet.created_at).toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                            },
                          )}
                        </span>
                      </div>
                      <span className="inline-flex items-center gap-0.5 font-medium">
                        <BananaCoin size={14} />
                        {bet.amount.toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            )}
          </div>

          {canBackroll && (
            <Card size="sm">
              <CardHeader className="pb-0">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <AlertTriangle className="size-4 text-warning" />
                  Admin Backroll
                </span>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Cancel all bets placed after a cutoff date and refund those
                  users. This action cannot be undone.
                </p>
                {backrollError && (
                  <p className="text-xs font-medium text-danger">
                    {backrollError}
                  </p>
                )}
                {backrollResult && (
                  <p className="text-xs font-medium text-success">
                    {backrollResult}
                  </p>
                )}
                <div className="space-y-1">
                  <label
                    htmlFor="backroll-date"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Cutoff Date/Time
                  </label>
                  <input
                    id="backroll-date"
                    type="datetime-local"
                    value={backrollDate}
                    onChange={(e) => setBackrollDate(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={backrollClose}
                    onChange={(e) => setBackrollClose(e.target.checked)}
                    className="rounded border-border"
                  />
                  Also close market at cutoff date
                </label>
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={handleBackroll}
                  disabled={backrolling || !backrollDate}
                >
                  {backrolling ? "Processing..." : "Execute Backroll"}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
