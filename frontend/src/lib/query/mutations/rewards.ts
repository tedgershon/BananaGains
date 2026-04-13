import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api";
import { invalidateAfterBadgeCheck } from "../invalidators";

export function useCheckBadges() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.checkBadges(),
    onSettled: () => invalidateAfterBadgeCheck(qc),
  });
}
