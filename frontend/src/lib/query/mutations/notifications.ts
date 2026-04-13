import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api";
import { invalidateAfterNotificationsRead } from "../invalidators";

// mark every unread notification as read (used when the page first mounts)
export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.markNotificationsRead(),
    onSettled: () => invalidateAfterNotificationsRead(qc),
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.markNotificationRead(id),
    onSettled: () => invalidateAfterNotificationsRead(qc),
  });
}

export function useDeleteNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteNotification(id),
    onSettled: () => invalidateAfterNotificationsRead(qc),
  });
}
