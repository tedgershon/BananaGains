"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMe } from "@/lib/query/queries/auth";
import { useUiStore } from "@/lib/stores/uiStore";

export default function AdminPage() {
  const router = useRouter();
  const { user } = useMe();
  const viewAsRole = useUiStore((s) => s.viewAsRole);

  const isAdmin = viewAsRole === "admin" || viewAsRole === "super_admin";
  const isSuperAdmin = viewAsRole === "super_admin";

  useEffect(() => {
    if (user.role === "user") {
      router.replace("/");
    }
  }, [user.role, router]);

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Manage markets, users, and view platform statistics.
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/admin/review">
          <Card className="transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle>Review Markets</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Review and approve or reject user-submitted markets.
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/stats">
          <Card className="transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle>Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                View cumulative platform statistics and analytics.
              </p>
            </CardContent>
          </Card>
        </Link>

        {isSuperAdmin && (
          <Link href="/admin/users">
            <Card className="transition-shadow hover:shadow-md">
              <CardHeader>
                <CardTitle>Manage Users</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Search users and manage role assignments.
                </p>
              </CardContent>
            </Card>
          </Link>
        )}
      </div>
    </div>
  );
}
