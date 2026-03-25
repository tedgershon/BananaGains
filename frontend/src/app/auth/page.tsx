"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

type Mode = "sign-in" | "sign-up";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [andrewId, setAndrewId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!supabase) {
    return (
      <div className="mx-auto mt-24 max-w-md text-center">
        <h1 className="mb-4 text-2xl font-bold">Auth Not Configured</h1>
        <p className="text-muted-foreground">
          Supabase environment variables are missing. The app is running in
          demo-user mode. Set{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-sm">
            NEXT_PUBLIC_SUPABASE_URL
          </code>{" "}
          and{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-sm">
            NEXT_PUBLIC_SUPABASE_ANON_KEY
          </code>{" "}
          in <code className="rounded bg-muted px-1.5 py-0.5 text-sm">.env.local</code>{" "}
          to enable authentication.
        </p>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setError(null);
    setLoading(true);

    try {
      if (mode === "sign-up") {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { andrew_id: andrewId, full_name: displayName },
          },
        });
        if (signUpError) throw signUpError;
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
      }
      router.push("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto mt-16 max-w-md">
      <div className="mb-8 text-center">
        <span className="text-4xl" role="img" aria-label="banana">
          🍌
        </span>
        <h1 className="mt-2 text-2xl font-bold">
          {mode === "sign-in" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "sign-in"
            ? "Sign in to start predicting"
            : "Join CMU's prediction market"}
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl border border-border bg-card p-6"
      >
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            placeholder="you@andrew.cmu.edu"
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            placeholder="At least 6 characters"
          />
        </div>

        {mode === "sign-up" && (
          <>
            <div>
              <label
                htmlFor="andrew-id"
                className="mb-1 block text-sm font-medium"
              >
                Andrew ID
              </label>
              <input
                id="andrew-id"
                type="text"
                required
                value={andrewId}
                onChange={(e) => setAndrewId(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                placeholder="e.g. at2"
              />
            </div>
            <div>
              <label
                htmlFor="display-name"
                className="mb-1 block text-sm font-medium"
              >
                Display Name
              </label>
              <input
                id="display-name"
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                placeholder="Your name"
              />
            </div>
          </>
        )}

        {error && (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {loading
            ? "Loading..."
            : mode === "sign-in"
              ? "Sign In"
              : "Create Account"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        {mode === "sign-in" ? (
          <>
            Don&apos;t have an account?{" "}
            <button
              type="button"
              onClick={() => {
                setMode("sign-up");
                setError(null);
              }}
              className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
            >
              Sign up
            </button>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => {
                setMode("sign-in");
                setError(null);
              }}
              className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
            >
              Sign in
            </button>
          </>
        )}
      </p>
    </div>
  );
}
