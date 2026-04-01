"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useData } from "@/lib/DataProvider";

const CATEGORIES = [
  "General",
  "Academics",
  "Campus Life",
  "Sports & Clubs",
  "Tech",
  "Politics",
];

export default function CreateMarketPage() {
  const router = useRouter();
  const { addMarket } = useData();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [closeAt, setCloseAt] = useState("");
  const [resolutionCriteria, setResolutionCriteria] = useState("");
  const [category, setCategory] = useState("General");
  const [error, setError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!description.trim()) {
      setError("Description is required.");
      return;
    }
    if (!closeAt) {
      setError("Close date is required.");
      return;
    }
    if (new Date(closeAt) <= new Date()) {
      setError("Close date must be in the future.");
      return;
    }
    if (!resolutionCriteria.trim()) {
      setError("Resolution criteria is required.");
      return;
    }

    setSubmitting(true);
    try {
      const market = await addMarket({
        title: title.trim(),
        description: description.trim(),
        close_at: new Date(closeAt).toISOString(),
        resolution_criteria: resolutionCriteria.trim(),
        category,
      });
      router.push(`/markets/${market.id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create market.",
      );
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20";

  return (
    <div className="space-y-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to markets
      </Link>

      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Create a Market</h1>
        <p className="text-sm text-muted-foreground">
          Define your prediction market for the CMU community
        </p>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <Card size="sm">
            <CardHeader className="pb-0">
              <span className="text-sm font-medium">Market Details</span>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="title" className="text-sm font-medium text-foreground">
                  Title
                </label>
                <input
                  id="title"
                  type="text"
                  placeholder="Will CMU...?"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="description" className="text-sm font-medium text-foreground">
                  Description
                </label>
                <textarea
                  id="description"
                  placeholder="Describe what this market is about..."
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={`${inputClass} resize-none`}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="resolutionCriteria" className="text-sm font-medium text-foreground">
                  Resolution Criteria
                </label>
                <textarea
                  id="resolutionCriteria"
                  placeholder="How will this market be resolved?"
                  rows={2}
                  value={resolutionCriteria}
                  onChange={(e) => setResolutionCriteria(e.target.value)}
                  className={`${inputClass} resize-none`}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card size="sm">
            <CardHeader className="pb-0">
              <span className="text-sm font-medium">Settings</span>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="closeAt" className="text-sm font-medium text-foreground">
                  Close Date
                </label>
                <input
                  id="closeAt"
                  type="datetime-local"
                  value={closeAt}
                  onChange={(e) => setCloseAt(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="category" className="text-sm font-medium text-foreground">
                  Category
                </label>
                <select
                  id="category"
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
            </CardContent>
          </Card>

          {error && (
            <p className="text-sm font-medium text-danger">{error}</p>
          )}

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={submitting}
          >
            {submitting ? <Spinner /> : "Create Market"}
          </Button>
        </div>
      </form>
    </div>
  );
}
