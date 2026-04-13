"use client";

import { BarChart3, Bell, List, LogOut, Settings, Trophy, User, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { useUnreadNotificationCount } from "@/hooks/use-unread-notification-count";
import { useSession } from "@/lib/SessionProvider";
import { cn } from "@/lib/utils";

const MENU_ITEMS = [
  { href: "/portfolio", label: "Portfolio", icon: Wallet },
  { href: "/portfolio#positions", label: "Positions", icon: BarChart3 },
  { href: "/portfolio#transactions", label: "Transaction History", icon: List },
  { href: "/rewards", label: "Rewards", icon: Trophy },
];

export function UserMenu() {
  const { user, isDemo, signOut } = useSession();
  const { unreadCount } = useUnreadNotificationCount(isDemo);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (isDemo) {
    return (
      <Link
        href="/auth"
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "px-4",
        )}
      >
        Sign In
      </Link>
    );
  }

  const initials = user.display_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative flex items-center"
        aria-label={
          unreadCount > 0
            ? `Account menu, ${unreadCount} unread notifications`
            : "Account menu"
        }
      >
        <div className="flex size-9 items-center justify-center overflow-hidden rounded-full border-2 border-border bg-muted text-sm font-medium text-muted-foreground transition-colors hover:bg-accent">
          {user.avatar_url ? (
            <img src={user.avatar_url} alt="" className="size-full object-cover" />
          ) : (
            initials
          )}
        </div>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-bold text-destructive-foreground ring-2 ring-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-border bg-card shadow-lg">
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <div className="flex size-10 items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-medium text-muted-foreground">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="" className="size-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold">
                  {user.display_name}
                </p>
                {(user.role === "admin" || user.role === "super_admin") && (
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                    {user.role === "super_admin" ? "Super Admin" : "Admin"}
                  </span>
                )}
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {user.andrew_id}
              </p>
            </div>
          </div>

          <div className="py-1">
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-accent"
            >
              <User size={16} className="text-muted-foreground" />
              <span>Profile</span>
            </Link>
            <div className="border-t border-border" />
            {MENU_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-accent"
              >
                <item.icon size={16} className="text-muted-foreground" />
                <span>{item.label}</span>
              </Link>
            ))}
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-accent"
            >
              <Bell size={16} className="text-muted-foreground" />
              <span className="flex-1">Notifications</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-destructive px-2 py-0.5 text-[11px] font-semibold text-destructive-foreground">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
            {(user.role === "admin" || user.role === "super_admin") && (
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-accent"
              >
                <Settings size={16} className="text-muted-foreground" />
                <span>Admin Panel</span>
              </Link>
            )}
          </div>

          <div className="border-t border-border py-1">
            <button
              type="button"
              onClick={async () => {
                setOpen(false);
                await signOut();
                router.push("/");
              }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-destructive transition-colors hover:bg-accent"
            >
              <LogOut size={16} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
