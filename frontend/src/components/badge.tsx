"use client";

import type { UserBadge } from "@/lib/types";

export function BadgeCircle({ badge }: { badge: UserBadge }) {
  const def = badge.badge_definitions;
  return (
    <div className="relative group" title={def.name}>
      <div
        className="size-6 rounded-full flex items-center justify-center text-white text-xs font-bold cursor-default"
        style={{ backgroundColor: def.color }}
      >
        {badge.tier}
      </div>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block whitespace-nowrap rounded bg-foreground px-2 py-1 text-xs text-background">
        {def.name}
      </div>
    </div>
  );
}
