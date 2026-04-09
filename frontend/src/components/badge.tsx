"use client";

import { BadgeIcon } from "@/components/badge-icon";
import type { UserBadge } from "@/lib/types";

export function BadgeCircle({
  badge,
  size = 24,
}: {
  badge: UserBadge;
  size?: number;
}) {
  const def = badge.badge_definitions;
  return (
    <div className="relative group">
      <BadgeIcon
        track={def.track}
        tier={badge.tier}
        color={def.color}
        earned
        size={size}
      />
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block whitespace-nowrap rounded bg-foreground px-2 py-1 text-xs text-background">
        {def.name}
      </div>
    </div>
  );
}
