import { queryOptions, useQuery } from "@tanstack/react-query";
import * as api from "@/lib/api";
import { GUEST_USER } from "@/lib/SessionProvider";
import { queryKeys } from "../keys";
import { STALE } from "../staleTimes";

// meQuery is the single source of truth for profile data
// nothing should mirror this into zustand or context state
export const meQuery = () =>
  queryOptions({
    queryKey: queryKeys.me,
    queryFn: () => api.getMe(),
    staleTime: STALE.ME,
    // 401 when logged out shouldn't retry
    retry: false,
  });

// thin wrapper that always returns a user shape so consumers don't have to
// guard against undefined during the first render or logged-out state
export function useMe() {
  const { data, isLoading, isFetching } = useQuery(meQuery());
  return { user: data ?? GUEST_USER, isLoading, isFetching };
}
