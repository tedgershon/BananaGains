"use client";

import { useQuery } from "@tanstack/react-query";
import { Check, Trash2 } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  useDeleteNotification,
  useMarkNotificationRead,
  useMarkNotificationsRead,
  useSendTestNotification,
} from "@/lib/query/mutations/notifications";
import { notificationsQuery } from "@/lib/query/queries/notifications";

export default function NotificationsPage() {
  const { data: notifications = [], isLoading } = useQuery(
    notificationsQuery(),
  );
  const markAll = useMarkNotificationsRead();
  const markOne = useMarkNotificationRead();
  const remove = useDeleteNotification();
  const sendTest = useSendTestNotification();

  // when we land on the page, clear the unread badge for anything already
  // shown — individual buttons still work for fine-grained control
  // biome-ignore lint/correctness/useExhaustiveDependencies: run once on mount
  useEffect(() => {
    markAll.mutate();
  }, []);

  const hasUnread = notifications.some((n) => !n.is_read);

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            Stay up to date with your markets and activity
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasUnread && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => markAll.mutate()}
              disabled={markAll.isPending}
            >
              {markAll.isPending ? "Updating…" : "Mark all read"}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => sendTest.mutate()}
            disabled={sendTest.isPending}
          >
            {sendTest.isPending ? "Sending..." : "Send Test Notification"}
          </Button>
        </div>
      </section>

      {isLoading ? (
        <Spinner className="size-6" />
      ) : notifications.length === 0 ? (
        <p className="text-muted-foreground">No notifications yet.</p>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const busy =
              (markOne.isPending && markOne.variables === n.id) ||
              (remove.isPending && remove.variables === n.id);
            return (
              <Card
                key={n.id}
                size="sm"
                className={
                  n.is_read ? "opacity-70" : "border-l-4 border-l-primary"
                }
              >
                <CardContent className="space-y-2 pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold">{n.title}</span>
                        {!n.is_read && (
                          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                            New
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(n.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {!n.is_read && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-foreground"
                          title="Mark as read"
                          disabled={busy}
                          onClick={() => markOne.mutate(n.id)}
                        >
                          <Check className="size-4" />
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        title="Delete"
                        disabled={busy}
                        onClick={() => remove.mutate(n.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <p className="whitespace-pre-line text-sm text-muted-foreground">
                    {n.body}
                  </p>
                  {typeof n.metadata?.market_id === "string" && (
                    <a
                      href={
                        n.type === "market_submitted"
                          ? `/admin/review?marketId=${n.metadata.market_id}`
                          : `/markets/${n.metadata.market_id}`
                      }
                      className="inline-block text-xs text-primary hover:underline"
                    >
                      {n.type === "market_submitted"
                        ? "Review Market →"
                        : "View Market →"}
                    </a>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
