"use client";

import { BarChart3, Bell, List, LogOut, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { useSession } from "@/lib/SessionProvider";
import { cn } from "@/lib/utils";

const MENU_ITEMS = [
  { href: "/portfolio", label: "Portfolio", icon: Wallet },
  { href: "/portfolio#positions", label: "Positions", icon: BarChart3 },
  { href: "/portfolio#transactions", label: "Transaction History", icon: List },
  { href: "/notifications", label: "Notifications", icon: Bell },
];

export function UserMenu() {
  const { user, isDemo, signOut } = useSession();
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
      >
        <div className="flex size-9 items-center justify-center rounded-full border-2 border-border bg-muted text-sm font-medium text-muted-foreground transition-colors hover:bg-accent">
          {initials}
        </div>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-border bg-card shadow-lg">
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
              {initials}
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
