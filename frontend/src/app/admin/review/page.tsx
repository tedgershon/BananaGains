"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import * as api from "@/lib/api";
import { useSession } from "@/lib/SessionProvider";
import type { Market } from "@/lib/types";

const CATEGORIES = [
  "General",
  "Academics",
  "Campus Life",
  "Sports & Clubs",
  "Tech",
  "Politics",
];

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getCreatorName(market: Market & Record<string, unknown>): string {
  const profiles = market.profiles as
    | { andrew_id?: string; display_name?: string }
    | undefined;
  return profiles?.andrew_id ?? "Unknown";
}

function getReviewerName(market: Market & Record<string, unknown>): string {
  const reviewer = market.reviewer as
    | { andrew_id?: string; display_name?: string }
    | undefined;
  return reviewer?.andrew_id ?? "—";
}

interface ReviewPanelProps {
  market: Market & Record<string, unknown>;
  onAction: () => void;
}

function ReviewPanel({ market, onAction }: ReviewPanelProps) {
  const [title, setTitle] = useState(market.title);
  const [description, setDescription] = useState(market.description);
  const [resolutionCriteria, setResolutionCriteria] = useState(
    market.resolution_criteria,
  );
  const [closeAt, setCloseAt] = useState(
    new Date(market.close_at).toISOString().slice(0, 16),
  );
  const [category, setCategory] = useState(market.category);
  const [link, setLink] = useState(market.link ?? "");
  const [notes, setNotes] = useState("");
  const [notesError, setNotesError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const prefix = `review-${market.id}`;
  const inputClass =
    "w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20";

  async function handleAction(action: "approve" | "deny") {
    setNotesError(null);
    setActionError(null);

    if (action === "deny" && !notes.trim()) {
      setNotesError("Notes are required when denying a market.");
      return;
    }

    setActionLoading(true);
    try {
      await api.reviewMarket(market.id, {
        action,
        notes: notes.trim() || null,
        title: title !== market.title ? title : null,
        description: description !== market.description ? description : null,
        resolution_criteria:
          resolutionCriteria !== market.resolution_criteria
            ? resolutionCriteria
            : null,
        close_at:
          closeAt !== new Date(market.close_at).toISOString().slice(0, 16)
            ? new Date(closeAt).toISOString()
            : null,
        category: category !== market.category ? category : null,
        link: link !== (market.link ?? "") ? link || null : null,
      });
      onAction();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="space-y-4 border-t pt-4 px-4 pb-4">
      <div className="grid gap-4 md:grid-cols-2">
        {/* Editable fields */}
        <div className="space-y-3">
          <div className="space-y-1">
            <label
              htmlFor={`${prefix}-title`}
              className="text-xs font-medium text-muted-foreground"
            >
              Title
            </label>
            <input
              id={`${prefix}-title`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="space-y-1">
            <label
              htmlFor={`${prefix}-desc`}
              className="text-xs font-medium text-muted-foreground"
            >
              Description
            </label>
            <textarea
              id={`${prefix}-desc`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className={`${inputClass} resize-none`}
            />
          </div>
          <div className="space-y-1">
            <label
              htmlFor={`${prefix}-res`}
              className="text-xs font-medium text-muted-foreground"
            >
              Resolution Criteria
            </label>
            <textarea
              id={`${prefix}-res`}
              value={resolutionCriteria}
              onChange={(e) => setResolutionCriteria(e.target.value)}
              rows={2}
              className={`${inputClass} resize-none`}
            />
          </div>
          <div className="space-y-1">
            <label
              htmlFor={`${prefix}-close`}
              className="text-xs font-medium text-muted-foreground"
            >
              Close Date
            </label>
            <input
              id={`${prefix}-close`}
              type="datetime-local"
              value={closeAt}
              onChange={(e) => setCloseAt(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="space-y-1">
            <label
              htmlFor={`${prefix}-cat`}
              className="text-xs font-medium text-muted-foreground"
            >
              Category
            </label>
            <select
              id={`${prefix}-cat`}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={inputClass}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label
              htmlFor={`${prefix}-link`}
              className="text-xs font-medium text-muted-foreground"
            >
              Link
            </label>
            <input
              id={`${prefix}-link`}
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://..."
              className={inputClass}
            />
          </div>
        </div>

        {/* Read-only fields */}
        <div className="space-y-3">
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">
              Official Source (read-only)
            </span>
            <p className="text-sm rounded-lg border border-border bg-muted/30 px-4 py-2.5">
              {market.official_source ?? "—"}
            </p>
          </div>
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">
              Yes Criteria (read-only)
            </span>
            <p className="text-sm rounded-lg border border-border bg-muted/30 px-4 py-2.5">
              {market.yes_criteria ?? "—"}
            </p>
          </div>
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">
              No Criteria (read-only)
            </span>
            <p className="text-sm rounded-lg border border-border bg-muted/30 px-4 py-2.5">
              {market.no_criteria ?? "—"}
            </p>
          </div>
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">
              Ambiguity Criteria (read-only)
            </span>
            <p className="text-sm rounded-lg border border-border bg-muted/30 px-4 py-2.5">
              {market.ambiguity_criteria ?? "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Notes + actions */}
      <div className="space-y-3">
        <div className="space-y-1">
          <label
            htmlFor={`${prefix}-notes`}
            className="text-xs font-medium text-muted-foreground"
          >
            Notes for Creator
          </label>
          <textarea
            id={`${prefix}-notes`}
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              setNotesError(null);
            }}
            placeholder="Leave a note for the market creator with feedback or suggested changes..."
            rows={3}
            className={`${inputClass} resize-none ${notesError ? "border-danger" : ""}`}
          />
          {notesError && <p className="text-xs text-danger">{notesError}</p>}
        </div>

        {actionError && <p className="text-sm text-danger">{actionError}</p>}

        <div className="flex gap-2">
          <Button
            variant="destructive"
            onClick={() => handleAction("deny")}
            disabled={actionLoading}
          >
            {actionLoading ? <Spinner /> : "Deny Market"}
          </Button>
          <Button
            className="bg-success text-success-foreground hover:bg-success/80"
            onClick={() => handleAction("approve")}
            disabled={actionLoading}
          >
            {actionLoading ? <Spinner /> : "Approve Market"}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface AccordionSectionProps {
  title: string;
  count: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function AccordionSection({
  title,
  count,
  defaultOpen = false,
  children,
}: AccordionSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card size="sm">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold">
          {title}{" "}
          <Badge variant="outline" className="ml-1">
            {count}
          </Badge>
        </span>
        {open ? (
          <ChevronDown className="size-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 text-muted-foreground" />
        )}
      </button>
      {open && <CardContent className="!pt-0">{children}</CardContent>}
    </Card>
  );
}

export default function AdminReviewPage() {
  const router = useRouter();
  const { user } = useSession();
  const [data, setData] = useState<{
    pending: Market[];
    approved: Market[];
    denied: Market[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (user.role === "user") {
      router.replace("/");
    }
  }, [user.role, router]);

  const fetchData = useCallback(async () => {
    try {
      const result = await api.getMarketsForReview();
      setData(result);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user.role !== "user") {
      fetchData();
    }
  }, [user.role, fetchData]);

  function handleAction() {
    setExpandedId(null);
    fetchData();
  }

  if (user.role === "user") return null;

  if (loading) {
    return (
      <div className="space-y-5">
        <section>
          <h1 className="text-3xl font-bold tracking-tight">Review Markets</h1>
        </section>
        <div className="flex justify-center py-12">
          <Spinner className="size-6" />
        </div>
      </div>
    );
  }

  const pending = data?.pending ?? [];
  const approved = data?.approved ?? [];
  const denied = data?.denied ?? [];

  function renderTable(
    markets: Market[],
    showReviewer: boolean,
    expandable: boolean,
  ) {
    if (markets.length === 0) {
      return (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No markets in this section.
        </p>
      );
    }

    return (
      <div className="divide-y divide-border">
        {/* Header */}
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-2 px-2 py-2 text-xs font-medium text-muted-foreground">
          <span>Title</span>
          <span>Proposed By</span>
          <span>Proposed Date</span>
          <span>Reviewed By</span>
          <span>Review Date</span>
        </div>
        {markets.map((market) => {
          const m = market as Market & Record<string, unknown>;
          const isExpanded = expandedId === market.id;
          return (
            <div key={market.id}>
              <button
                type="button"
                onClick={() => {
                  if (expandable) {
                    setExpandedId(isExpanded ? null : market.id);
                  }
                }}
                className={`grid w-full grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-2 px-2 py-2.5 text-left text-sm ${expandable ? "cursor-pointer hover:bg-muted/50" : ""}`}
              >
                <span className="font-medium truncate">{market.title}</span>
                <span className="text-muted-foreground">
                  {getCreatorName(m)}
                </span>
                <span className="text-muted-foreground">
                  {formatDate(market.created_at)}
                </span>
                <span className="text-muted-foreground">
                  {showReviewer ? getReviewerName(m) : "—"}
                </span>
                <span className="text-muted-foreground">
                  {showReviewer ? formatDate(market.review_date) : "—"}
                </span>
              </button>
              {expandable && isExpanded && (
                <ReviewPanel market={m} onAction={handleAction} />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Review Markets</h1>
          <p className="text-sm text-muted-foreground">
            Review, edit, and approve or deny proposed markets.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData}>
          Refresh
        </Button>
      </section>

      <div className="space-y-3">
        <AccordionSection
          title="Pending Review"
          count={pending.length}
          defaultOpen
        >
          {renderTable(pending, false, true)}
        </AccordionSection>

        <AccordionSection title="Approved" count={approved.length}>
          {renderTable(approved, true, false)}
        </AccordionSection>

        <AccordionSection title="Denied" count={denied.length}>
          {renderTable(denied, true, false)}
        </AccordionSection>
      </div>
    </div>
  );
}
