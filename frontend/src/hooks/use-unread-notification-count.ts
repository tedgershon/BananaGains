"use client";

import { useCallback, useEffect, useState } from "react";
import * as api from "@/lib/api";

export const NOTIFICATIONS_CHANGED_EVENT = "bananagains:notifications-updated";

export function notifyNotificationsChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
  }
}

export function useUnreadNotificationCount(isDemo: boolean) {
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    if (isDemo) {
      setUnreadCount(0);
      return;
    }
    try {
      const data = await api.getUnreadNotificationCount();
      const n = data.count;
      setUnreadCount(typeof n === "number" ? n : Number(n) || 0);
    } catch {
      setUnreadCount(0);
    }
  }, [isDemo]);

  useEffect(() => {
    void refresh();
    if (isDemo) return;
    const onEvent = () => {
      void refresh();
    };
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onEvent);
    const interval = setInterval(() => {
      void refresh();
    }, 30000);
    return () => {
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onEvent);
      clearInterval(interval);
    };
  }, [isDemo, refresh]);

  return { unreadCount, refresh };
}
