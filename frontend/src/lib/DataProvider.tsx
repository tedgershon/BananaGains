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
  addMarket: (req: CreateMarketRequest) => Promise<Market>;
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
  const { user, updateBalance } = useSession();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [bets, setBets] = useState<Bet[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [mkts, userBets, txs] = await Promise.all([
          api.listMarkets(),
          api.getPortfolio(),
          api.getTransactions(),
        ]);
        if (cancelled) return;
        setMarkets(mkts);
        setBets(userBets);
        setTransactions(txs);
      } catch (err) {
        console.error("Failed to load initial data:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

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

  const value = useMemo(
    () => ({
      markets,
      bets,
      transactions,
      loading,
      addMarket,
      placeBet,
      refreshMarkets,
      fetchMarket,
    }),
    [
      markets,
      bets,
      transactions,
      loading,
      addMarket,
      placeBet,
      refreshMarkets,
      fetchMarket,
    ],
  );

  return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>;
}
