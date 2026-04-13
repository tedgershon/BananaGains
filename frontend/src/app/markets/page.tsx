"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BananaCoin } from "@/components/banana-coin";
import { CategoryFilter } from "@/components/category-filter";
import { buildPriceHistory } from "@/components/hottest-market";
import { MarketCard } from "@/components/market-card";
import { ProbabilityChart } from "@/components/probability-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { listBetsForMarket } from "@/lib/api";
import { useData } from "@/lib/DataProvider";
import type { Market, PricePoint } from "@/lib/types";
import { getMarketProbability } from "@/lib/types";

const MAX_TRENDING_MARKETS = 4;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

async function getVolumeStats(marketId: string, windowStartMs: number) {
  const limit = 200;
  let offset = 0;
  let rolling7Day = 0;
  let allTime = 0;

  while (true) {
    const bets = await listBetsForMarket(marketId, { limit, offset });
    if (bets.length === 0) break;

    for (const bet of bets) {
      allTime += bet.amount;
      const placedAt = new Date(bet.created_at).getTime();
      if (placedAt >= windowStartMs) {
        rolling7Day += bet.amount;
      }
    }

    if (bets.length < limit) break;
    offset += limit;
  }

  return { rolling7Day, allTime };
}

function getAllTimeMarketVolume(market: Market) {
  if (market.market_type === "multichoice" && market.options?.length) {
    return market.options.reduce((sum, opt) => sum + opt.pool_total, 0);
  }
  return market.yes_pool_total + market.no_pool_total;
}

function getDominantChoice(market: Market): { label: string; pct: number } {
  if (market.market_type === "multichoice" && market.options?.length) {
    const opts = market.options;
    const totalPool = opts.reduce((s, o) => s + o.pool_total, 0);
    const sorted = [...opts].sort((a, b) => b.pool_total - a.pool_total);
    const leader = sorted[0];
    const pct =
      totalPool > 0 ? Math.round((leader.pool_total / totalPool) * 100) : 0;
    return { label: leader.label, pct };
  }
  const probability = getMarketProbability(market);
  return probability >= 50
    ? { label: "Yes", pct: probability }
    : { label: "No", pct: 100 - probability };
}

function TrendingFeaturedMarkets({ markets }: { markets: Market[] }) {
  const [trendingMarkets, setTrendingMarkets] = useState<Market[]>([]);
  const [rollingVolumeByMarketId, setRollingVolumeByMarketId] = useState<
    Record<string, number>
  >({});
  const [volumeWindowLabel, setVolumeWindowLabel] = useState<"7d" | "all-time">(
    "7d",
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [loadingTrending, setLoadingTrending] = useState(true);
  const [chartData, setChartData] = useState<PricePoint[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadTrendingMarkets() {
      setLoadingTrending(true);

      const openMarkets = markets.filter((m) => m.status === "open");
      if (openMarkets.length === 0) {
        if (!cancelled) {
          setTrendingMarkets([]);
          setRollingVolumeByMarketId({});
          setActiveIndex(0);
          setLoadingTrending(false);
        }
        return;
      }

      const windowStartMs = Date.now() - WEEK_MS;
      const rankedWithVolume = await Promise.all(
        openMarkets.map(async (market) => {
          try {
            const volumeStats = await getVolumeStats(market.id, windowStartMs);
            return {
              market,
              rolling7Day: volumeStats.rolling7Day,
              allTime:
                volumeStats.allTime > 0
                  ? volumeStats.allTime
                  : getAllTimeMarketVolume(market),
            };
          } catch {
            return {
              market,
              rolling7Day: 0,
              allTime: getAllTimeMarketVolume(market),
            };
          }
        }),
      );

      if (cancelled) return;

      const sevenDayTrending = rankedWithVolume
        .filter((entry) => entry.rolling7Day > 0)
        .sort((a, b) => b.rolling7Day - a.rolling7Day)
        .slice(0, MAX_TRENDING_MARKETS);

      const useAllTimeFallback = sevenDayTrending.length === 0;
      const topTrending = useAllTimeFallback
        ? rankedWithVolume
            .filter((entry) => entry.allTime > 0)
            .sort((a, b) => b.allTime - a.allTime)
            .slice(0, MAX_TRENDING_MARKETS)
        : sevenDayTrending;

      const volumeMap = Object.fromEntries(
        topTrending.map((entry) => [
          entry.market.id,
          useAllTimeFallback ? entry.allTime : entry.rolling7Day,
        ]),
      );

      setTrendingMarkets(topTrending.map((entry) => entry.market));
      setRollingVolumeByMarketId(volumeMap);
      setVolumeWindowLabel(useAllTimeFallback ? "all-time" : "7d");
      setActiveIndex((idx) => {
        if (topTrending.length === 0) return 0;
        return Math.min(idx, topTrending.length - 1);
      });
      setLoadingTrending(false);
    }

    loadTrendingMarkets().catch(() => {
      if (!cancelled) {
        setTrendingMarkets([]);
        setRollingVolumeByMarketId({});
        setVolumeWindowLabel("7d");
        setActiveIndex(0);
        setLoadingTrending(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [markets]);

  const activeMarket = trendingMarkets[activeIndex] ?? null;
  const probability = activeMarket ? getMarketProbability(activeMarket) : 0;
  const rollingVolume = activeMarket
    ? rollingVolumeByMarketId[activeMarket.id] ?? 0
    : 0;

  const loadChart = useCallback(async (m: Market | null) => {
    if (!m) {
      setChartData([]);
      return;
    }
    if (m.market_type !== "binary") {
      setChartData([]);
      return;
    }
    try {
      const bets = await listBetsForMarket(m.id);
      setChartData(buildPriceHistory(bets));
    } catch {
      setChartData([]);
    }
  }, []);

  useEffect(() => {
    loadChart(activeMarket);
  }, [activeMarket, loadChart]);

  const hasTrendingMarkets = trendingMarkets.length > 0;

  function showPreviousMarket() {
    setActiveIndex((idx) => Math.max(0, idx - 1));
  }

  function showNextMarket() {
    setActiveIndex((idx) => Math.min(trendingMarkets.length - 1, idx + 1));
  }

  return (
    <Card className="h-full market-card-open border-0 rounded-xl">
      <CardHeader className="pb-0">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          Trending Markets
        </CardTitle>
        <CardAction className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Previous trending market"
            onClick={showPreviousMarket}
            disabled={!hasTrendingMarkets || activeIndex === 0}
            className="flex size-7 items-center justify-center rounded-full border border-border bg-background text-xs font-medium text-foreground leading-none transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            {"<"}
          </button>
          <span className="min-w-12 text-center text-xs font-medium text-foreground tabular-nums">
            {hasTrendingMarkets
              ? `${activeIndex + 1} of ${trendingMarkets.length}`
              : "0 of 0"}
          </span>
          <button
            type="button"
            aria-label="Next trending market"
            onClick={showNextMarket}
            disabled={!hasTrendingMarkets || activeIndex === trendingMarkets.length - 1}
            className="flex size-7 items-center justify-center rounded-full border border-border bg-background text-xs font-medium text-foreground leading-none transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            {">"}
          </button>
        </CardAction>
      </CardHeader>

      <CardContent className="!pt-0 pb-0">
        {loadingTrending ? (
          <div className="flex min-h-[220px] items-center justify-center">
            <Spinner className="size-6" />
          </div>
        ) : !activeMarket ? (
          <div className="flex min-h-[220px] items-center justify-center rounded-lg bg-muted/30 px-4 text-center text-sm text-muted-foreground">
            No trending markets yet.
          </div>
        ) : (
          <Link href={`/markets/${activeMarket.id}`}>
            <div className="grid h-full sm:grid-cols-2">
              <div className="flex flex-col gap-2.5 px-2 pb-0 pt-0 sm:pr-6">
                <div className="flex items-center gap-2">
                  <span className="glimmer-dot size-2.5 rounded-full bg-success" />
                  <Badge variant="outline">{activeMarket.category}</Badge>
                </div>
                <h3 className="text-lg font-semibold leading-snug">
                  {activeMarket.title}
                </h3>
                {activeMarket.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {activeMarket.description}
                  </p>
                )}
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <BananaCoin size={14} />
                  <span>
                    {rollingVolume.toLocaleString()} {volumeWindowLabel === "all-time" ? "total coin volume" : "7d vol"}
                  </span>
                </div>
                <div className="mt-auto flex flex-col gap-2">
                  <Button
                    size="lg"
                    className="w-full bg-success text-success-foreground [box-shadow:0_4px_0_color-mix(in_oklch,var(--color-success)_70%,black)] active:[box-shadow:0_2px_0_color-mix(in_oklch,var(--color-success)_70%,black)]"
                  >
                    Yes {probability}%
                  </Button>
                  <Button
                    size="lg"
                    className="w-full bg-danger text-danger-foreground [box-shadow:0_4px_0_color-mix(in_oklch,var(--color-danger)_70%,black)] active:[box-shadow:0_2px_0_color-mix(in_oklch,var(--color-danger)_70%,black)]"
                  >
                    No {100 - probability}%
                  </Button>
                </div>
              </div>

              <div className="min-h-[200px] px-2 pb-0 pt-0 sm:pl-0 sm:pr-2">
                {activeMarket.market_type === "binary" && chartData.length > 0 ? (
                  <ProbabilityChart data={chartData} />
                ) : (
                  <div className="flex h-full w-full items-center justify-center rounded-lg bg-muted/30 text-sm text-muted-foreground">
                    {activeMarket.market_type === "binary"
                      ? "No bet history yet"
                      : "Multichoice market"}
                  </div>
                )}
              </div>
            </div>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

function Trending({ markets }: { markets: Market[] }) {
  const newest = useMemo(() => {
    return [...markets]
      .filter((m) => m.status === "open")
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      .slice(0, 3);
  }, [markets]);

  return (
    <Card className="h-full market-card-open border-0 rounded-xl">
      <CardHeader className="pb-0">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          Newest Markets
        </CardTitle>
      </CardHeader>
      <CardContent className="!p-0">
        {newest.length === 0 ? (
          <p className="px-6 py-4 text-sm text-muted-foreground">
            No new markets yet.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {newest.map((market) => {
              const dominant = getDominantChoice(market);
              return (
                <Link
                  key={market.id}
                  href={`/markets/${market.id}`}
                  className="flex items-center gap-3 px-6 py-3 transition-colors hover:bg-accent/50"
                >
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold leading-snug truncate">
                      {market.title}
                    </h4>
                    <span className="text-xs text-muted-foreground">
                      {market.category}
                    </span>
                  </div>
                  <span className="shrink-0 text-lg font-bold">
                    {dominant.pct}%
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function MarketsPage() {
  const { markets, loading } = useData();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = useMemo(
    () => [...new Set(markets.map((m) => m.category))],
    [markets],
  );

  const filtered = selectedCategory
    ? markets.filter((m) => m.category === selectedCategory)
    : markets;

  const now = Date.now();

  function isInResolutionWindow(m: { resolution_window_end?: string | null }) {
    return (
      m.resolution_window_end != null &&
      new Date(m.resolution_window_end).getTime() > now
    );
  }

  const openMarkets = filtered.filter((m) => m.status === "open");
  const inResolutionMarkets = filtered.filter(
    (m) => m.status !== "open" && isInResolutionWindow(m),
  );
  const closedMarkets = filtered.filter(
    (m) => m.status !== "open" && !isInResolutionWindow(m),
  );

  return (
    <>
      <div
        className="-mt-6"
        style={{
          marginLeft: "calc(-50vw + 50%)",
          marginRight: "calc(-50vw + 50%)",
        }}
      >
        <CategoryFilter
          categories={categories}
          selected={selectedCategory}
          onSelect={setSelectedCategory}
        />
      </div>

      <div className="mt-6 space-y-8">
        <section className="space-y-4">
          <h1 className="text-3xl font-bold tracking-tight">Markets</h1>
          {!loading && (
            <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
              <TrendingFeaturedMarkets markets={filtered} />
              <Trending markets={filtered} />
            </div>
          )}
        </section>

        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner className="size-6" />
          </div>
        ) : (
          <>
            <section className="space-y-4">
              <h2 className="text-lg font-semibold">
                Open Markets ({openMarkets.length})
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {openMarkets.map((market) => (
                  <MarketCard key={market.id} market={market} />
                ))}
              </div>
            </section>

            {inResolutionMarkets.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-lg font-semibold">
                  In Resolution ({inResolutionMarkets.length})
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {inResolutionMarkets.map((market) => (
                    <MarketCard key={market.id} market={market} />
                  ))}
                </div>
              </section>
            )}

            {closedMarkets.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-lg font-semibold">
                  Closed ({closedMarkets.length})
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {closedMarkets.map((market) => (
                    <MarketCard key={market.id} market={market} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
}
