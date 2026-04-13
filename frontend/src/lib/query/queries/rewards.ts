import { queryOptions } from "@tanstack/react-query";
import * as api from "@/lib/api";
import { queryKeys } from "../keys";
import { STALE } from "../staleTimes";

export const rewardsQuery = () =>
  queryOptions({
    queryKey: queryKeys.rewards,
    queryFn: () => api.getUserRewards(),
    staleTime: STALE.REWARDS,
  });
