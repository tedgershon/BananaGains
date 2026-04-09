"use client";

import { ArrowLeft, Info } from "lucide-react";
import Link from "next/link";
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

const URL_REGEX = /^https?:\/\/[^\s/$.?#].[^\s]*$/;

export default function CreateMarketPage() {
  const { addMarket } = useData();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [closeAt, setCloseAt] = useState("");
  const [resolutionCriteria, setResolutionCriteria] = useState("");
  const [officialSource, setOfficialSource] = useState("");
  const [yesCriteria, setYesCriteria] = useState("");
  const [noCriteria, setNoCriteria] = useState("");
  const [ambiguityCriteria, setAmbiguityCriteria] = useState("");
  const [category, setCategory] = useState("General");
  const [link, setLink] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [marketType, setMarketType] = useState<"binary" | "multichoice">(
    "binary",
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLinkError(null);

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
    if (link && !URL_REGEX.test(link)) {
      setLinkError("Invalid URL. Must start with http:// or https://");
      return;
    }
    if (!officialSource.trim()) {
      setError("Official source is required.");
      return;
    }
    if (!yesCriteria.trim()) {
      setError("Yes criteria is required.");
      return;
    }
    if (!noCriteria.trim()) {
      setError("No criteria is required.");
      return;
    }
    if (!ambiguityCriteria.trim()) {
      setError("Ambiguity criteria is required.");
      return;
    }

    setSubmitting(true);
    try {
      await addMarket({
        title: title.trim(),
        description: description.trim(),
        close_at: new Date(closeAt).toISOString(),
        resolution_criteria: resolutionCriteria.trim(),
        category,
        official_source: officialSource.trim(),
        yes_criteria: yesCriteria.trim(),
        no_criteria: noCriteria.trim(),
        ambiguity_criteria: ambiguityCriteria.trim(),
        link: link.trim() || undefined,
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create market.");
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20";

  if (submitted) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
          <div className="text-4xl">🎉</div>
          <h1 className="text-2xl font-bold tracking-tight">
            Market Submitted!
          </h1>
          <p className="text-sm text-muted-foreground max-w-md">
            Your market has been submitted for review! You&apos;ll be notified
            when an admin approves it.
          </p>
          <Link href="/">
            <Button variant="outline">Back to Home</Button>
          </Link>
        </div>
      </div>
    );
  }

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

      <form
        onSubmit={handleSubmit}
        className="grid gap-4 lg:grid-cols-[2fr_1fr]"
      >
        <div className="space-y-4">
          {/* Market type selector */}
          <Card size="sm">
            <CardHeader className="pb-0">
              <span className="text-sm font-medium">Market Type</span>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="marketType"
                    value="binary"
                    checked={marketType === "binary"}
                    onChange={() => setMarketType("binary")}
                    className="accent-primary"
                  />
                  <span className="text-sm font-medium">Binary (Yes / No)</span>
                </label>
                <label className="flex items-center gap-2 cursor-not-allowed opacity-50">
                  <input
                    type="radio"
                    name="marketType"
                    value="multichoice"
                    checked={marketType === "multichoice"}
                    disabled
                    className="accent-primary"
                  />
                  <span className="text-sm font-medium">
                    Multiple Choice (coming soon)
                  </span>
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Public-facing fields */}
          <Card size="sm">
            <CardHeader className="pb-0">
              <span className="text-sm font-medium">
                Market Details (Public)
              </span>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="title"
                  className="text-sm font-medium text-foreground"
                >
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
                <label
                  htmlFor="description"
                  className="text-sm font-medium text-foreground"
                >
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
                <label
                  htmlFor="link"
                  className="text-sm font-medium text-foreground"
                >
                  Link (optional)
                </label>
                <input
                  id="link"
                  type="url"
                  placeholder="https://example.com/relevant-article"
                  value={link}
                  onChange={(e) => {
                    setLink(e.target.value);
                    setLinkError(null);
                  }}
                  className={`${inputClass} ${linkError ? "border-danger" : ""}`}
                />
                {linkError && (
                  <p className="text-xs text-danger">{linkError}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="resolutionCriteria"
                  className="text-sm font-medium text-foreground"
                >
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

          {/* Admin-only fields */}
          <Card size="sm" className="border-dashed bg-muted/50">
            <CardHeader className="pb-0">
              <span className="text-sm font-medium">
                Review Information (Admin Only)
              </span>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-2 rounded-md bg-primary/10 px-3 py-2 text-xs text-primary">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                These fields will be reviewed by admins and are not publicly
                displayed.
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="officialSource"
                  className="text-sm font-medium text-foreground"
                >
                  Official Source
                </label>
                <input
                  id="officialSource"
                  type="text"
                  placeholder="e.g. CMU news, official website, verified report"
                  value={officialSource}
                  onChange={(e) => setOfficialSource(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="yesCriteria"
                  className="text-sm font-medium text-foreground"
                >
                  Yes Criteria
                </label>
                <textarea
                  id="yesCriteria"
                  placeholder="What counts as YES?"
                  rows={2}
                  value={yesCriteria}
                  onChange={(e) => setYesCriteria(e.target.value)}
                  className={`${inputClass} resize-none`}
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="noCriteria"
                  className="text-sm font-medium text-foreground"
                >
                  No Criteria
                </label>
                <textarea
                  id="noCriteria"
                  placeholder="What counts as NO?"
                  rows={2}
                  value={noCriteria}
                  onChange={(e) => setNoCriteria(e.target.value)}
                  className={`${inputClass} resize-none`}
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="ambiguityCriteria"
                  className="text-sm font-medium text-foreground"
                >
                  Ambiguity Criteria
                </label>
                <textarea
                  id="ambiguityCriteria"
                  placeholder="How should ambiguous or partial outcomes be handled?"
                  rows={2}
                  value={ambiguityCriteria}
                  onChange={(e) => setAmbiguityCriteria(e.target.value)}
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
                <label
                  htmlFor="closeAt"
                  className="text-sm font-medium text-foreground"
                >
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
                <label
                  htmlFor="category"
                  className="text-sm font-medium text-foreground"
                >
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

          {error && <p className="text-sm font-medium text-danger">{error}</p>}

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={submitting}
          >
            {submitting ? <Spinner /> : "Submit for Review"}
          </Button>
        </div>
      </form>
    </div>
  );
}
