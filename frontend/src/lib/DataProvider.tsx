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
import * as api from "./api";
import { useSession } from "./SessionProvider";
import { DEMO_USER } from "./mock-data";
import type {
  Bet,
  BetSide,
  CreateMarketRequest,
  Market,
  Transaction,
} from "./types";

interface DataContextValue {
  markets: Market[];
  bets: Bet[];
  transactions: Transaction[];
  loading: boolean;
  claimDaily: () => Promise<void>;
  addMarket: (req: CreateMarketRequest) => Promise<Market>;
  resolveMarket: (marketId: string, outcome: BetSide) => Promise<void>;
  placeBet: (marketId: string, side: BetSide, amount: number) => Promise<void>;
  refreshMarkets: () => Promise<void>;
  fetchMarket: (id: string) => Promise<Market>;
}

const DataCtx = createContext<DataContextValue | null>(null);

export function useData(): DataContextValue {
  const ctx = useContext(DataCtx);
  if (!ctx) throw new Error("useData must be used within a DataProvider");
  return ctx;
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { user, isDemo, updateBalance, markClaimedToday } = useSession();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [bets, setBets] = useState<Bet[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const mkts = await api.listMarkets();
        if (cancelled) return;
        setMarkets(mkts);
      } catch (err: any) {
        // Only log if it's not a generic 401 when we are just completely unauthenticated out the gate
        console.error("Failed to load markets:", err);
      }

      if (!isDemo && user.id !== DEMO_USER.id) {
        try {
          const [userBets, txs] = await Promise.all([
            api.getPortfolio(),
            api.getTransactions(),
          ]);
          if (cancelled) return;
          setBets(userBets);
          setTransactions(txs);
        } catch (err: any) {
          if (err?.status !== 401) {
            console.error("Failed to load user data:", err);
          }
        }
      } else {
        if (!cancelled) {
          setBets([]);
          setTransactions([]);
        }
      }

      if (!cancelled) setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [isDemo, user.id]);

  const refreshMarkets = useCallback(async () => {
    const mkts = await api.listMarkets();
    setMarkets(mkts);
  }, []);

  const fetchMarket = useCallback(async (id: string): Promise<Market> => {
    const market = await api.getMarket(id);
    setMarkets((prev) => {
      const idx = prev.findIndex((m) => m.id === id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = market;
        return next;
      }
      return [market, ...prev];
    });
    return market;
  }, []);

  const addMarket = useCallback(
    async (req: CreateMarketRequest): Promise<Market> => {
      const market = await api.createMarket(req);
      setMarkets((prev) => [market, ...prev]);
      return market;
    },
    [],
  );

  const resolveMarket = useCallback(
    async (marketId: string, outcome: BetSide): Promise<void> => {
      await api.resolveMarket(marketId, { outcome });

      // Reflect the status change locally immediately
      setMarkets((prev) =>
        prev.map((m) => {
          if (m.id !== marketId) return m;
          return {
            ...m,
            status: "resolved",
            resolved_outcome: outcome,
            resolved_at: new Date().toISOString(),
          };
        }),
      );

      // Refresh the user's transactions and balance to reflect potential payouts
      Promise.all([
        api.getPortfolio(),
        api.getTransactions(),
        api.getMe(),
      ])
        .then(([newBets, newTxs, profile]) => {
          setBets(newBets);
          setTransactions(newTxs);
          updateBalance(profile.banana_balance - user.banana_balance);
        })
        .catch(console.error);
    },
    [updateBalance, user.banana_balance],
  );

  const placeBet = useCallback(
    async (marketId: string, side: BetSide, amount: number): Promise<void> => {
      const res = await api.placeBet(marketId, { side, amount });

      setMarkets((prev) =>
        prev.map((m) => {
          if (m.id !== marketId) return m;
          return side === "YES"
            ? { ...m, yes_pool_total: m.yes_pool_total + amount }
            : { ...m, no_pool_total: m.no_pool_total + amount };
        }),
      );

      updateBalance(res.new_balance - user.banana_balance);

      const now = new Date().toISOString();
      setBets((prev) => [
        {
          id: res.bet_id,
          user_id: user.id,
          market_id: marketId,
          side,
          amount,
          created_at: now,
        },
        ...prev,
      ]);
      setTransactions((prev) => [
        {
          id: `tx-${res.bet_id}`,
          user_id: user.id,
          market_id: marketId,
          transaction_type: "bet_placement" as const,
          amount: -amount,
          created_at: now,
        },
        ...prev,
      ]);
    },
    [user.id, user.banana_balance, updateBalance],
  );

  const claimDaily = useCallback(async () => {
    await api.claimDaily();
    updateBalance(1000);
    markClaimedToday();
    const now = new Date().toISOString();
    setTransactions((prev) => [
      {
        id: `daily-${Date.now()}`,
        user_id: user.id,
        market_id: null,
        transaction_type: "daily_claim" as const,
        amount: 1000,
        created_at: now,
      },
      ...prev,
    ]);
  }, [user.id, updateBalance, markClaimedToday]);

  const value = useMemo(
    () => ({
      markets,
      bets,
      transactions,
      loading,
      claimDaily,
      addMarket,
      resolveMarket,
      placeBet,
      refreshMarkets,
      fetchMarket,
    }),
    [
      markets,
      bets,
      transactions,
      loading,
      claimDaily,
      addMarket,
      resolveMarket,
      placeBet,
      refreshMarkets,
      fetchMarket,
    ],
  );

  return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>;
}
