"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getMe } from "./api";
import { DEMO_USER } from "./mock-data";
import { supabase } from "./supabase";
import type { UserProfile } from "./types";

interface SessionContextValue {
  user: UserProfile;
  isDemo: boolean;
  isLoading: boolean;
  updateBalance: (delta: number) => void;
}

const SessionCtx = createContext<SessionContextValue>({
  user: DEMO_USER,
  isDemo: true,
  isLoading: false,
  updateBalance: () => {},
});

export function useSession() {
  return useContext(SessionCtx);
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile>(DEMO_USER);
  const [isDemo, setIsDemo] = useState(true);
  const [isLoading, setIsLoading] = useState(!!supabase);

  const updateBalance = useCallback((delta: number) => {
    setUser((prev) => ({
      ...prev,
      banana_balance: prev.banana_balance + delta,
    }));
  }, []);

  async function loadProfile() {
    try {
      const profile = await getMe();
      setUser(profile);
      setIsDemo(false);
    } catch {
      setUser(DEMO_USER);
      setIsDemo(true);
    }
  }

  useEffect(() => {
    if (!supabase) {
      loadProfile().finally(() => setIsLoading(false));
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        loadProfile().finally(() => setIsLoading(false));
      } else {
        loadProfile().finally(() => setIsLoading(false));
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        loadProfile();
      } else {
        setUser(DEMO_USER);
        setIsDemo(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const value = useMemo(
    () => ({ user, isDemo, isLoading, updateBalance }),
    [user, isDemo, isLoading, updateBalance],
  );

  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>;
}
