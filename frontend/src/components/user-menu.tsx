"use client";

import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Bell,
  List,
  LogOut,
  Trophy,
  User,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { useMe } from "@/lib/query/queries/auth";
import { unreadCountQuery } from "@/lib/query/queries/notifications";
import { useSession } from "@/lib/SessionProvider";
import { cn } from "@/lib/utils";

const MENU_ITEMS = [
  { href: "/portfolio", label: "Portfolio", icon: Wallet },
  { href: "/portfolio#positions", label: "Positions", icon: BarChart3 },
  { href: "/portfolio#transactions", label: "Transaction History", icon: List },
  { href: "/rewards", label: "Rewards", icon: Trophy },
];

export function UserMenu() {
  const { isDemo, signOut } = useSession();
  const { user } = useMe();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // unread count polls every 30s via refetchInterval in the query
  const { data: unread } = useQuery({
    ...unreadCountQuery(),
    enabled: !isDemo,
  });
  const unreadCount = unread?.count ?? 0;

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
      >
        <div className="flex size-9 items-center justify-center overflow-hidden rounded-full border-2 border-border bg-muted text-sm font-medium text-muted-foreground transition-colors hover:bg-accent">
          {user.avatar_url ? (
            <img
              src={user.avatar_url}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            initials
          )}
        </div>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-danger border-2 border-white" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-border bg-card shadow-lg">
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <div className="flex size-10 items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-medium text-muted-foreground">
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                initials
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {user.display_name}
              </p>
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
              className="flex items-center justify-between px-4 py-2.5 text-sm transition-colors hover:bg-accent"
            >
              <div className="flex items-center gap-3">
                <Bell size={16} className="text-muted-foreground" />
                <span>Notifications</span>
              </div>
              {unreadCount > 0 && (
                <span className="inline-flex items-center justify-center size-5 rounded-full bg-danger text-danger-foreground text-xs font-bold">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>
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
