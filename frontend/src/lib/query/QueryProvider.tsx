"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import type { ReactNode } from "react";
import { getQueryClient } from "./client";

/**
 * Mounts the app's QueryClient at the root of the client tree.
 *
 * On the server, `getQueryClient()` returns a fresh client per request.
 * On the client, it returns the module-level singleton so cache survives
 * navigation. Devtools are only rendered in development.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === "development" ? (
        <ReactQueryDevtools initialIsOpen={false} />
      ) : null}
    </QueryClientProvider>
  );
}
