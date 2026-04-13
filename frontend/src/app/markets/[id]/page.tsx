import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query/client";
import { betsForMarketQuery, marketQuery } from "@/lib/query/queries/markets";
import MarketDetailClient from "./detail-client";

// prefetches the core market record + bet history in parallel so the detail
// page renders immediately, charts and all
export default async function MarketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const qc = getQueryClient();
  await Promise.all([
    qc.prefetchQuery(marketQuery(id)),
    qc.prefetchQuery(betsForMarketQuery(id)),
  ]);
  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <MarketDetailClient id={id} />
    </HydrationBoundary>
  );
}
