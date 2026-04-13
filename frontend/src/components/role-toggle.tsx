"use client";

import { useMe } from "@/lib/query/queries/auth";
import { useUiStore } from "@/lib/stores/uiStore";
import type { UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  user: "User",
};

export function RoleToggle() {
  const { user } = useMe();
  const viewAsRole = useUiStore((s) => s.viewAsRole);
  const setViewAsRole = useUiStore((s) => s.setViewAsRole);

  const availableRoles: UserRole[] =
    user.role === "super_admin"
      ? ["super_admin", "admin", "user"]
      : user.role === "admin"
        ? ["admin", "user"]
        : [];

  if (availableRoles.length === 0) return null;

  return (
    <div className="flex items-center rounded-lg border border-border bg-muted/50 p-0.5 text-xs">
      {availableRoles.map((role) => (
        <button
          key={role}
          type="button"
          onClick={() => setViewAsRole(role)}
          className={cn(
            "rounded-md px-2 py-1 font-medium transition-colors",
            viewAsRole === role
              ? "bg-white text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {ROLE_LABELS[role]}
        </button>
      ))}
    </div>
  );
}
