import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api";
import type { BackrollRequest, ReviewMarketRequest } from "@/lib/types";
import {
  invalidateAfterAdminReview,
  invalidateAfterBackroll,
  invalidateAfterUserRoleUpdate,
} from "../invalidators";

export function useReviewMarket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { marketId: string; body: ReviewMarketRequest }) =>
      api.reviewMarket(vars.marketId, vars.body),
    onSettled: () => invalidateAfterAdminReview(qc),
  });
}

export function useBackrollMarket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { marketId: string; body: BackrollRequest }) =>
      api.backrollMarket(vars.marketId, vars.body),
    onSettled: (_d, _e, vars) => invalidateAfterBackroll(qc, vars.marketId),
  });
}

export function useUpdateUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { userId: string; role: string }) =>
      api.updateUserRole(vars.userId, vars.role),
    onSettled: () => invalidateAfterUserRoleUpdate(qc),
  });
}
