"use client";

import Link from "next/link";
import { useState } from "react";
import { BananaCoin } from "@/components/banana-coin";
import { useSession } from "@/lib/SessionProvider";

export function DailyClaimBanner() {
  const { user, isDemo, isLoading } = useSession();
  const [dismissed, setDismissed] = useState(false);

  if (isLoading || isDemo || user.claimed_today || dismissed) return null;

  return (
    <div className="bg-primary/10 border-b border-primary/20">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2">
        <Link
          href="/portfolio"
          className="flex items-center gap-2 text-sm hover:underline"
        >
          <BananaCoin size={18} />
          <span className="font-medium">
            Your daily 1,000 bananas are ready to claim!
          </span>
        </Link>
        <button
          onClick={() => setDismissed(true)}
          className="text-muted-foreground hover:text-foreground text-sm px-1"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
