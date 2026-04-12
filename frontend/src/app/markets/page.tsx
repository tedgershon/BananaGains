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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { listBetsForMarket } from "@/lib/api";
import { useData } from "@/lib/DataProvider";
import type { Market, PricePoint } from "@/lib/types";
import { getMarketProbability } from "@/lib/types";

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

function FeaturedMarket({ market }: { market: Market }) {
  const [chartData, setChartData] = useState<PricePoint[]>([]);
  const volume = market.yes_pool_total + market.no_pool_total;
  const probability = getMarketProbability(market);

  const loadChart = useCallback(async (m: Market) => {
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
    loadChart(market);
  }, [market, loadChart]);

  return (
    <Link href={`/markets/${market.id}`}>
      <Card className="h-full market-card-open border-0 rounded-xl !py-0">
        <div className="grid sm:grid-cols-2 h-full">
          <div className="flex flex-col gap-3 p-6">
            <div className="flex items-center gap-2">
              <span className="glimmer-dot size-2.5 rounded-full bg-success" />
              <Badge variant="outline">{market.category}</Badge>
            </div>
            <h3 className="text-lg font-semibold leading-snug">
              {market.title}
            </h3>
            {market.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {market.description}
              </p>
            )}
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <BananaCoin size={14} />
              <span>{volume.toLocaleString()} vol</span>
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

          <div className="p-6 pl-0 min-h-[200px]">
            {market.market_type === "binary" && chartData.length > 0 ? (
              <ProbabilityChart data={chartData} />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-lg bg-muted/30 text-sm text-muted-foreground">
                {market.market_type === "binary"
                  ? "No bet history yet"
                  : "Multichoice market"}
              </div>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}

function BreakingNews({ markets }: { markets: Market[] }) {
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
          📰 Breaking News
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

  const featuredMarket = useMemo(() => {
    const open = filtered.filter((m) => m.status === "open");
    if (open.length === 0) return null;
    return open.reduce((best, m) => {
      const vol = m.yes_pool_total + m.no_pool_total;
      const bestVol = best.yes_pool_total + best.no_pool_total;
      return vol > bestVol ? m : best;
    });
  }, [filtered]);

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
          {!loading && featuredMarket && (
            <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
              <FeaturedMarket market={featuredMarket} />
              <BreakingNews markets={filtered} />
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
