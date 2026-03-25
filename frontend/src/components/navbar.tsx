"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BananaCoin } from "@/components/banana-coin";
import { useSession } from "@/lib/SessionProvider";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/", label: "Markets" },
  { href: "/leaderboard", label: "Leaderboard" },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isDemo, signOut } = useSession();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold">
            <span className="text-2xl" role="img" aria-label="banana">
              🍌
            </span>
            <span>BananaGains</span>
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-full px-3 py-2 text-sm font-medium transition-colors hover:bg-accent",
                  pathname === link.href
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground",
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/portfolio"
            className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-accent"
          >
            <BananaCoin size={16} />
            <span>{user.banana_balance.toLocaleString()}</span>
          </Link>
          <Link
            href="/markets/create"
            className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Create Market
          </Link>
          {isDemo ? (
            <Link
              href="/auth"
              className="rounded-full border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
            >
              Sign In
            </Link>
          ) : (
            <button
              type="button"
              onClick={async () => {
                await signOut();
                router.push("/");
              }}
              className="rounded-full border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
            >
              Sign Out
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
