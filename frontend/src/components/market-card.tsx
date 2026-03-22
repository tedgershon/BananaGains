import Link from "next/link";
import { BananaCoin } from "@/components/banana-coin";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { Market } from "@/lib/types";
import { getMarketProbability } from "@/lib/types";
import { cn } from "@/lib/utils";

function formatCloseDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (days < 0) return "Closed";
  if (days === 0) return "Closes today";
  if (days === 1) return "Closes tomorrow";
  if (days <= 7) return `Closes in ${days} days`;
  return `Closes ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

function StatusDot({ status }: { status: Market["status"] }) {
  if (status === "open") {
    return <span className="glimmer-dot size-2.5 rounded-full bg-success" />;
  }
  if (status === "disputed") {
    return <Badge variant="destructive">disputed</Badge>;
  }
  return <span className="size-2.5 rounded-full bg-muted-foreground/40" />;
}

export function MarketCard({ market }: { market: Market }) {
  const probability = getMarketProbability(market);
  const total = market.yes_pool_total + market.no_pool_total;
  const isOpen = market.status === "open";

  return (
    <Link href={`/markets/${market.id}`}>
      <Card
        className={cn(
          "h-full",
          isOpen ? "market-card-open border-0 rounded-xl" : "",
        )}
      >
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-3">
          <div className="flex-1 space-y-1.5">
            <div className="flex items-center gap-2">
              <StatusDot status={market.status} />
              <Badge variant="outline">{market.category}</Badge>
            </div>
            <h3 className="text-base font-semibold leading-snug">
              {market.title}
            </h3>
          </div>
          <div className="flex flex-col items-center rounded-lg bg-accent px-3 py-2">
            <span className="text-2xl font-bold">{probability}%</span>
            <span className="text-xs text-muted-foreground">chance</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm">
                <span className="w-8 font-medium text-success">Yes</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-success transition-all"
                    style={{ width: `${probability}%` }}
                  />
                </div>
                <span className="inline-flex w-20 items-center justify-end gap-0.5 font-medium text-success">
                  <BananaCoin size={14} />
                  {market.yes_pool_total.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="w-8 font-medium text-danger">No</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-danger transition-all"
                    style={{ width: `${100 - probability}%` }}
                  />
                </div>
                <span className="inline-flex w-20 items-center justify-end gap-0.5 font-medium text-danger">
                  <BananaCoin size={14} />
                  {market.no_pool_total.toLocaleString()}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-0.5">
                <BananaCoin size={14} />
                {total.toLocaleString()} pool
              </span>
              <span>{formatCloseDate(market.close_at)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
