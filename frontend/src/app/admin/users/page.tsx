"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { searchUsers, updateUserRole } from "@/lib/api";
import { useSession } from "@/lib/SessionProvider";
import type { UserSearchResult } from "@/lib/types";

export default function AdminUsersPage() {
  const router = useRouter();
  const { user } = useSession();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (user.role !== "super_admin") {
      router.replace("/admin");
    }
  }, [user.role, router]);

  if (user.role !== "super_admin") return null;

  async function handleSearch() {
    const q = query.trim();
    if (!q) return;

    setLoading(true);
    setMessage(null);
    try {
      const data = await searchUsers(q);
      setResults(data);
      setSearched(true);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to search users");
    } finally {
      setLoading(false);
    }
  }

  async function handleRoleChange(userId: string, newRole: string) {
    setUpdating(userId);
    setMessage(null);
    try {
      const updated = await updateUserRole(userId, newRole);
      setResults((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: updated.role } : u)),
      );
      setMessage(`Role updated to ${updated.role} successfully.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to update role");
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div className="space-y-5">
      <section>
        <h1 className="text-3xl font-bold tracking-tight">Manage Users</h1>
        <p className="text-sm text-muted-foreground">
          Search users by Andrew ID and manage their roles.
        </p>
      </section>

      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSearch();
          }}
          placeholder="Search by Andrew ID..."
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <Button onClick={handleSearch} disabled={loading || !query.trim()}>
          {loading ? <Spinner /> : "Search"}
        </Button>
      </div>

      {message && <p className="text-sm text-muted-foreground">{message}</p>}

      {searched && results.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No user found with that Andrew ID.
        </p>
      )}

      {results.length > 0 && (
        <Card size="sm" className="!gap-0 !py-0">
          <CardContent className="!p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Andrew ID</th>
                  <th className="px-4 py-2 font-medium">Display Name</th>
                  <th className="px-4 py-2 font-medium">Role</th>
                  <th className="px-4 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {results.map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-2 font-mono text-xs">
                      {u.andrew_id}
                    </td>
                    <td className="px-4 py-2">{u.display_name}</td>
                    <td className="px-4 py-2 capitalize">
                      {u.role.replace("_", " ")}
                    </td>
                    <td className="px-4 py-2">
                      {u.role === "super_admin" ? (
                        <span className="text-xs text-muted-foreground">
                          Super Admin
                        </span>
                      ) : u.role === "user" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={updating === u.id}
                          onClick={() => handleRoleChange(u.id, "admin")}
                        >
                          {updating === u.id ? <Spinner /> : "Promote to Admin"}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={updating === u.id}
                          onClick={() => handleRoleChange(u.id, "user")}
                        >
                          {updating === u.id ? <Spinner /> : "Demote to User"}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
