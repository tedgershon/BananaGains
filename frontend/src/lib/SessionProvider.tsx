"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { DEMO_USER } from "./mock-data";
import { supabase } from "./supabase";
import type { UserProfile } from "./types";

interface SessionContextValue {
  user: UserProfile;
  /** True when the app is running with the hardcoded demo user. */
  isDemo: boolean;
  /** True while the initial session check is in flight. */
  isLoading: boolean;
}

const SessionCtx = createContext<SessionContextValue>({
  user: DEMO_USER,
  isDemo: true,
  isLoading: false,
});

export function useSession() {
  return useContext(SessionCtx);
}

/**
 * Wraps the app with session state.
 *
 * Sprint 1 behaviour: always provides DEMO_USER (Supabase env vars are unset).
 * When Supabase is configured the provider listens to auth-state changes and
 * fetches the real profile from /api/auth/me — wired in Sprint 2.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile>(DEMO_USER);
  const [isDemo, setIsDemo] = useState(true);
  const [isLoading, setIsLoading] = useState(!!supabase);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setIsLoading(false);
        return;
      }
      // Sprint 2: fetch real profile via getMe() and call setUser / setIsDemo
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setUser(DEMO_USER);
        setIsDemo(true);
      }
      // Sprint 2: on sign-in, fetch profile and update state
    });

    return () => subscription.unsubscribe();
  }, []);

  const value = useMemo(
    () => ({ user, isDemo, isLoading }),
    [user, isDemo, isLoading],
  );

  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>;
}
