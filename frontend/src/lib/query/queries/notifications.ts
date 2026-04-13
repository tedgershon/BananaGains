import { queryOptions } from "@tanstack/react-query";
import * as api from "@/lib/api";
import { queryKeys } from "../keys";
import { STALE } from "../staleTimes";

export const notificationsQuery = (params?: {
  limit?: number;
  offset?: number;
}) =>
  queryOptions({
    queryKey: queryKeys.notifications.list(params),
    queryFn: () => api.listNotifications(params),
    staleTime: STALE.NOTIFICATIONS,
  });

// poll unread count every 30s so the nav badge stays fresh without websockets
export const unreadCountQuery = () =>
  queryOptions({
    queryKey: queryKeys.notifications.unreadCount,
    queryFn: () => api.getUnreadNotificationCount(),
    staleTime: STALE.NOTIFICATIONS,
    refetchInterval: 30_000,
  });
