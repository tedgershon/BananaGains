"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useMarkNotificationsRead } from "@/lib/query/mutations/notifications";
import { notificationsQuery } from "@/lib/query/queries/notifications";

export default function NotificationsPage() {
  const { data: notifications = [], isLoading } = useQuery(
    notificationsQuery(),
  );
  const markRead = useMarkNotificationsRead();

  // fire-and-forget mark-as-read on mount so the unread badge drops
  // biome-ignore lint/correctness/useExhaustiveDependencies: run once on mount
  useEffect(() => {
    markRead.mutate();
  }, []);

  return (
    <div className="space-y-6">
      <section className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
        <p className="text-sm text-muted-foreground">
          Stay up to date with your markets and activity
        </p>
      </section>

      {isLoading ? (
        <Spinner className="size-6" />
      ) : notifications.length === 0 ? (
        <p className="text-muted-foreground">No notifications yet.</p>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <Card
              key={n.id}
              size="sm"
              className={n.is_read ? "opacity-60" : ""}
            >
              <CardContent className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{n.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(n.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="whitespace-pre-line text-sm text-muted-foreground">
                  {n.body}
                </p>
                {n.metadata?.market_id && (
                  <a
                    href={`/markets/${n.metadata.market_id}`}
                    className="text-xs text-primary hover:underline"
                  >
                    View Market →
                  </a>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
