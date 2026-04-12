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
import { supabase } from "./supabase";
import type { UserProfile, UserRole } from "./types";

/** Default user state for unauthenticated sessions. */
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
  user: UserProfile;
  isDemo: boolean;
  isLoading: boolean;
  updateBalance: (delta: number) => void;
  updateUser: (partial: Partial<UserProfile>) => void;
  markClaimedToday: () => void;
  signOut: () => Promise<void>;
  viewAsRole: UserRole;
  setViewAsRole: (role: UserRole) => void;
}

const SessionCtx = createContext<SessionContextValue>({
  user: GUEST_USER,
  isDemo: true,
  isLoading: false,
  updateBalance: () => {},
  updateUser: () => {},
  markClaimedToday: () => {},
  signOut: async () => {},
  viewAsRole: "user",
  setViewAsRole: () => {},
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
  const [user, setUser] = useState<UserProfile>(initialUser ?? GUEST_USER);
  const [isDemo, setIsDemo] = useState(!initialUser);
  const [isLoading, setIsLoading] = useState(!initialUser);
  const [viewAsRole, setViewAsRole] = useState<UserRole>(
    initialUser?.role ?? "user",
  );

  const updateBalance = useCallback((delta: number) => {
    setUser((prev) => ({
      ...prev,
      banana_balance: prev.banana_balance + delta,
    }));
  }, []);

  const updateUser = useCallback((partial: Partial<UserProfile>) => {
    setUser((prev) => ({ ...prev, ...partial }));
  }, []);

  const markClaimedToday = useCallback(() => {
    setUser((prev) => ({ ...prev, claimed_today: true }));
  }, []);

  const loadProfile = useCallback(async () => {
    try {
      const profile = await getMe();
      setUser(profile);
      setIsDemo(false);
      setViewAsRole(profile.role ?? "user");
    } catch {
      setUser(GUEST_USER);
      setIsDemo(true);
      setViewAsRole("user");
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
        setUser(GUEST_USER);
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
        setUser(GUEST_USER);
        setIsDemo(true);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUser(GUEST_USER);
    setIsDemo(true);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isDemo,
      isLoading,
      updateBalance,
      updateUser,
      markClaimedToday,
      signOut,
      viewAsRole,
      setViewAsRole,
    }),
    [
      user,
      isDemo,
      isLoading,
      updateBalance,
      updateUser,
      markClaimedToday,
      signOut,
      viewAsRole,
    ],
  );

  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>;
}
