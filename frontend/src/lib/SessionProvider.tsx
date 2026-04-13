"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { queryKeys } from "./query/keys";
import { supabase } from "./supabase";
import type { UserProfile } from "./types";

// still exported because useMe() falls back to this when the cache is empty
// (logged out, first paint, 401), keeps consumers from having to null-check
export const GUEST_USER: UserProfile = {
  id: "00000000-0000-0000-0000-000000000000",
  andrew_id: "",
  display_name: "Guest",
  banana_balance: 0,
  created_at: new Date().toISOString(),
  claimed_today: false,
  role: "user",
  is_admin: false,
  claim_eligible: false,
  claim_amount: 0,
  above_cap: false,
  equipped_badge_id: null,
  equipped_badges: {},
  avatar_url: null,
};

interface SessionContextValue {
  isDemo: boolean;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

const SessionCtx = createContext<SessionContextValue>({
  isDemo: true,
  isLoading: false,
  signOut: async () => {},
});

export function useSession() {
  return useContext(SessionCtx);
}

// session-shell provider — holds only auth-session bits
// profile data lives in the me query (useMe), never here
export function SessionProvider({
  children,
  initialUser,
}: {
  children: ReactNode;
  initialUser?: UserProfile | null;
}) {
  const qc = useQueryClient();
  const [isDemo, setIsDemo] = useState(!initialUser);
  const [isLoading, setIsLoading] = useState(!initialUser);

  // seed the me cache from SSR-fetched user so the first paint has real data
  // and nothing else has to know about the initialUser prop
  useState(() => {
    if (initialUser) qc.setQueryData(queryKeys.me, initialUser);
  });

  useEffect(() => {
    if (!supabase) {
      // no supabase configured — we're permanently in demo mode
      setIsDemo(true);
      setIsLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsDemo(false);
        // refresh the cache in the background so we're not trusting stale SSR
        qc.invalidateQueries({ queryKey: queryKeys.me });
      } else {
        setIsDemo(true);
        qc.removeQueries({ queryKey: queryKeys.me });
      }
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setIsDemo(false);
        qc.invalidateQueries({ queryKey: queryKeys.me });
      } else {
        setIsDemo(true);
        qc.removeQueries({ queryKey: queryKeys.me });
      }
    });

    return () => subscription.unsubscribe();
  }, [qc]);

  const signOut = useCallback(async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setIsDemo(true);
    qc.removeQueries({ queryKey: queryKeys.me });
  }, [qc]);

  const value = useMemo(
    () => ({ isDemo, isLoading, signOut }),
    [isDemo, isLoading, signOut],
  );

  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>;
}
