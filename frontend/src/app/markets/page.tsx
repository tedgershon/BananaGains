import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query/client";
import { marketsQuery } from "@/lib/query/queries/markets";
import MarketsClient from "./markets-client";

// server component — prefetches the markets list so the client renders with
// real data on first paint, no loading spinner
export default async function MarketsPage() {
  const qc = getQueryClient();
  await qc.prefetchQuery(marketsQuery());
  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <MarketsClient />
    </HydrationBoundary>
  );
}
