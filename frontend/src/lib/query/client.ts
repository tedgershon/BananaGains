import {
  type DefaultOptions,
  isServer,
  QueryClient,
} from "@tanstack/react-query";
import { STALE } from "./staleTimes";

const defaultOptions: DefaultOptions = {
  queries: {
    staleTime: STALE.DEFAULT,
    gcTime: 5 * 60_000,
    retry: 1,
    refetchOnWindowFocus: true,
  },
};

function makeQueryClient() {
  return new QueryClient({ defaultOptions });
}

let clientQueryClient: QueryClient | undefined;

/**
 * Returns a QueryClient suitable for the current runtime.
 *
 * - **Server**: a fresh `QueryClient` per request. Never cache across requests
 *   — that would leak user-scoped data between users.
 * - **Client**: a lazily-initialised module-level singleton, so navigating
 *   between routes reuses the same cache.
 *
 * See the TanStack "Advanced SSR" guide for the rationale.
 */
export function getQueryClient(): QueryClient {
  if (isServer) return makeQueryClient();
  if (!clientQueryClient) clientQueryClient = makeQueryClient();
  return clientQueryClient;
}
