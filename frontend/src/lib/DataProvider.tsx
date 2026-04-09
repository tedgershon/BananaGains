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
import * as api from "./api";
import { DEMO_USER } from "./mock-data";
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
  claimDaily: () => Promise<void>;
  addMarket: (req: CreateMarketRequest) => Promise<Market>;
  resolveMarket: (marketId: string, outcome: BetSide) => Promise<void>;
  disputeMarket: (marketId: string, explanation: string) => Promise<void>;
  castDisputeVote: (marketId: string, vote: BetSide) => Promise<void>;
  placeBet: (marketId: string, side: BetSide, amount: number) => Promise<void>;
  placeMultichoiceBet: (
    marketId: string,
    optionId: string,
    amount: number,
  ) => Promise<void>;
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
      } catch (err: unknown) {
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
        } catch (err: unknown) {
          const apiError = err as { status?: number } | undefined;
          if (apiError?.status !== 401) {
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
      const res = await api.resolveMarket(marketId, { outcome });

      // Reflect the status change locally immediately
      setMarkets((prev) =>
        prev.map((m) => {
          if (m.id !== marketId) return m;
          return {
            ...m,
            status: res.status ?? "pending_resolution",
            proposed_outcome: res.proposed_outcome ?? outcome,
            proposed_at: new Date().toISOString(),
            dispute_deadline: res.dispute_deadline ?? null,
          };
        }),
      );

      // Refresh the user's transactions and balance to reflect potential payouts
      Promise.all([api.getPortfolio(), api.getTransactions(), api.getMe()])
        .then(([newBets, newTxs, profile]) => {
          setBets(newBets);
          setTransactions(newTxs);
          updateBalance(profile.banana_balance - user.banana_balance);
        })
        .catch(console.error);
    },
    [updateBalance, user.banana_balance],
  );

  const disputeMarket = useCallback(
    async (marketId: string, explanation: string): Promise<void> => {
      const res = await api.fileDispute(marketId, { explanation });
      setMarkets((prev) =>
        prev.map((m) =>
          m.id === marketId
            ? {
                ...m,
                status: "disputed",
                disputed_at: res.created_at,
                disputed_by: res.disputer_id,
                voting_ends_at: res.voting_deadline,
              }
            : m,
        ),
      );
    },
    [],
  );

  const castDisputeVote = useCallback(
    async (marketId: string, vote: BetSide): Promise<void> => {
      await api.castDisputeVote(marketId, { vote });
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
          option_id: null,
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

  const placeMultichoiceBet = useCallback(
    async (
      marketId: string,
      optionId: string,
      amount: number,
    ): Promise<void> => {
      const res = await api.placeMultichoiceBet(marketId, {
        option_id: optionId,
        amount,
      });

      setMarkets((prev) =>
        prev.map((m) => {
          if (m.id !== marketId) return m;
          if (!m.options) return m;
          return {
            ...m,
            options: m.options.map((opt) =>
              opt.id === optionId
                ? { ...opt, pool_total: opt.pool_total + amount }
                : opt,
            ),
          };
        }),
      );

      updateBalance(res.new_balance - user.banana_balance);

      const now = new Date().toISOString();
      setBets((prev) => [
        {
          id: res.bet_id,
          user_id: user.id,
          market_id: marketId,
          side: null,
          option_id: optionId,
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
    const result = await api.claimDaily();
    const claimedAmount = result.claimed_amount ?? 1000;
    updateBalance(claimedAmount);
    markClaimedToday();
    const now = new Date().toISOString();
    setTransactions((prev) => [
      {
        id: `daily-${Date.now()}`,
        user_id: user.id,
        market_id: null,
        transaction_type: "daily_claim" as const,
        amount: claimedAmount,
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
      disputeMarket,
      castDisputeVote,
      placeBet,
      placeMultichoiceBet,
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
      disputeMarket,
      castDisputeVote,
      placeBet,
      placeMultichoiceBet,
      refreshMarkets,
      fetchMarket,
    ],
  );

  return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>;
}
