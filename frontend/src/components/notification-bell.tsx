"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useUnreadNotificationCount } from "@/hooks/use-unread-notification-count";
import { useSession } from "@/lib/SessionProvider";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const { isDemo } = useSession();
  const { unreadCount } = useUnreadNotificationCount(isDemo);

  if (isDemo) {
    return null;
  }

  return (
    <Link
      href="/notifications"
      className={cn(
        "relative flex items-center justify-center size-9 rounded-full",
        "border border-border bg-background transition-colors hover:bg-accent",
      )}
      aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
    >
      <Bell size={18} className="text-muted-foreground" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[11px] font-bold">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </Link>
  );
}
