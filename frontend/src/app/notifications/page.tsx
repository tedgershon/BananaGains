"use client";

import { Check, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { notifyNotificationsChanged } from "@/hooks/use-unread-notification-count";
import * as api from "@/lib/api";
import type { NotificationResponse } from "@/lib/types";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationResponse[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    try {
      const data = await api.listNotifications();
      setNotifications(data);
    } catch {
      /* empty */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const sendTestNotification = async () => {
    setSending(true);
    try {
      await api.sendTestNotification();
      await loadNotifications();
      notifyNotificationsChanged();
    } catch (err) {
      console.error("Failed to send test notification:", err);
      alert("Failed to send notification. Check console for details.");
    }
    setSending(false);
  };

  const markOneRead = async (id: string) => {
    setBusyId(id);
    try {
      await api.markNotificationRead(id);
      await loadNotifications();
      notifyNotificationsChanged();
    } catch {
      /* empty */
    }
    setBusyId(null);
  };

  const removeOne = async (id: string) => {
    setBusyId(id);
    try {
      await api.deleteNotification(id);
      await loadNotifications();
      notifyNotificationsChanged();
    } catch {
      /* empty */
    }
    setBusyId(null);
  };

  const markAllRead = async () => {
    setBusyId("all");
    try {
      await api.markNotificationsRead();
      await loadNotifications();
      notifyNotificationsChanged();
    } catch {
      /* empty */
    }
    setBusyId(null);
  };

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
              onClick={markAllRead}
              disabled={busyId === "all"}
            >
              {busyId === "all" ? "Updating…" : "Mark all read"}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={sendTestNotification}
            disabled={sending}
          >
            {sending ? "Sending..." : "Send Test Notification"}
          </Button>
        </div>
      </section>

      {loading ? (
        <Spinner className="size-6" />
      ) : notifications.length === 0 ? (
        <p className="text-muted-foreground">No notifications yet.</p>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <Card
              key={n.id}
              size="sm"
              className={n.is_read ? "opacity-70" : "border-l-4 border-l-primary"}
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
                        disabled={busyId === n.id}
                        onClick={() => markOneRead(n.id)}
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
                      disabled={busyId === n.id}
                      onClick={() => removeOne(n.id)}
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
                    href={`/markets/${n.metadata.market_id}`}
                    className="inline-block text-xs text-primary hover:underline"
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
