"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
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
  markClaimedToday: () => void;
  signOut: () => Promise<void>;
}

const SessionCtx = createContext<SessionContextValue>({
  user: DEMO_USER,
  isDemo: true,
  isLoading: false,
  updateBalance: () => {},
  markClaimedToday: () => {},
  signOut: async () => {},
});

export function useSession() {
  return useContext(SessionCtx);
}

export function SessionProvider({
  children,
  initialUser,
}: {
  children: ReactNode;
  initialUser?: UserProfile | null;
}) {
  const [user, setUser] = useState<UserProfile>(initialUser ?? DEMO_USER);
  const [isDemo, setIsDemo] = useState(!initialUser);
  const [isLoading, setIsLoading] = useState(!initialUser);

  const updateBalance = useCallback((delta: number) => {
    setUser((prev) => ({
      ...prev,
      banana_balance: prev.banana_balance + delta,
    }));
  }, []);

  const markClaimedToday = useCallback(() => {
    setUser((prev) => ({ ...prev, claimed_today: true }));
  }, []);

  const loadProfile = useCallback(async () => {
    try {
      const profile = await getMe();
      setUser(profile);
      setIsDemo(false);
    } catch {
      setUser(DEMO_USER);
      setIsDemo(true);
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      loadProfile().finally(() => setIsLoading(false));
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        loadProfile().finally(() => setIsLoading(false));
      } else {
        setUser(DEMO_USER);
        setIsDemo(true);
        setIsLoading(false);
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
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUser(DEMO_USER);
    setIsDemo(true);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isDemo,
      isLoading,
      updateBalance,
      markClaimedToday,
      signOut,
    }),
    [user, isDemo, isLoading, updateBalance, markClaimedToday, signOut],
  );

  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>;
}
