"use client";

import { useMemo, useState } from "react";
import { CategoryFilter } from "@/components/category-filter";
import { MarketCard } from "@/components/market-card";
import { Spinner } from "@/components/ui/spinner";
import { useData } from "@/lib/DataProvider";

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
        className="-mx-4 sm:-mx-6 lg:-mx-8"
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
        <section className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Markets</h1>
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
