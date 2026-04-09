"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BananaCoin } from "@/components/banana-coin";
import { RoleToggle } from "@/components/role-toggle";
import { Button, buttonVariants } from "@/components/ui/button";
import { useSession } from "@/lib/SessionProvider";
import { cn } from "@/lib/utils";

const NAV_LINKS: { href: string; label: string; adminOnly?: boolean }[] = [
  { href: "/", label: "Markets" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/admin", label: "Admin", adminOnly: true },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isDemo, signOut, viewAsRole } = useSession();

  const isAdminView = viewAsRole === "admin" || viewAsRole === "super_admin";

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
            {NAV_LINKS.filter((link) => !link.adminOnly || isAdminView).map(
              (link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent",
                    pathname === link.href ||
                      (link.href === "/admin" && pathname.startsWith("/admin"))
                      ? "text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {link.label}
                </Link>
              ),
            )}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          {!isDemo && user.role !== "user" && <RoleToggle />}
          {!isDemo && (
            <>
              <Link
                href="/portfolio"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "gap-1.5",
                )}
              >
                <BananaCoin size={16} />
                <span>{user.banana_balance.toLocaleString()}</span>
              </Link>
              <Link
                href="/markets/create"
                className={cn(
                  buttonVariants({ variant: "default", size: "sm" }),
                  "px-4",
                )}
              >
                Create Market
              </Link>
            </>
          )}
          {isDemo ? (
            <Link
              href="/auth"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "px-4",
              )}
            >
              Sign In
            </Link>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await signOut();
                router.push("/");
              }}
            >
              Sign Out
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
