"use client";

import { useMemo, useState } from "react";
import { CategoryFilter } from "@/components/category-filter";
import { MarketCard } from "@/components/market-card";
import { MOCK_MARKETS } from "@/lib/mock-data";

export default function Home() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = useMemo(
    () => [...new Set(MOCK_MARKETS.map((m) => m.category))],
    [],
  );

  const filtered = selectedCategory
    ? MOCK_MARKETS.filter((m) => m.category === selectedCategory)
    : MOCK_MARKETS;

  const openMarkets = filtered.filter((m) => m.status === "open");
  const closedMarkets = filtered.filter((m) => m.status !== "open");

  return (
    <>
      <div className="-mt-6" style={{ marginLeft: "calc(-50vw + 50%)", marginRight: "calc(-50vw + 50%)" }}>
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

        {closedMarkets.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">
              Closed & Resolved ({closedMarkets.length})
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {closedMarkets.map((market) => (
                <MarketCard key={market.id} market={market} />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
