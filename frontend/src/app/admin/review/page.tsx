"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/lib/SessionProvider";

export default function AdminReviewPage() {
  const router = useRouter();
  const { user } = useSession();

  useEffect(() => {
    if (user.role === "user") {
      router.replace("/");
    }
  }, [user.role, router]);

  if (user.role === "user") return null;

  return (
    <div className="space-y-5">
      <section>
        <h1 className="text-3xl font-bold tracking-tight">Review Markets</h1>
        <p className="text-sm text-muted-foreground">
          Market review functionality will be available after the market
          creation review feature is implemented.
        </p>
      </section>
    </div>
  );
}
