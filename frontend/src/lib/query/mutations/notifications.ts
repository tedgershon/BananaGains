import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api";
import { invalidateAfterNotificationsRead } from "../invalidators";

export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.markNotificationsRead(),
    onSettled: () => invalidateAfterNotificationsRead(qc),
  });
}
