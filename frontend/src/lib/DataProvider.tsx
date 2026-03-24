"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  MOCK_BETS,
  MOCK_MARKETS,
  MOCK_PRICE_HISTORY,
  MOCK_TRANSACTIONS,
  type PricePoint,
} from "./mock-data";
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
  priceHistory: Record<string, PricePoint[]>;
  addMarket: (req: CreateMarketRequest) => Market;
  placeBet: (marketId: string, side: BetSide, amount: number) => Bet;
}

const DataCtx = createContext<DataContextValue | null>(null);

export function useData(): DataContextValue {
  const ctx = useContext(DataCtx);
  if (!ctx) throw new Error("useData must be used within a DataProvider");
  return ctx;
}

let nextMarketSeq = MOCK_MARKETS.length + 1;
let nextBetSeq = MOCK_BETS.length + 1;
let nextTxSeq = MOCK_TRANSACTIONS.length + 1;

export function DataProvider({ children }: { children: ReactNode }) {
  const { user, updateBalance } = useSession();
  const [markets, setMarkets] = useState<Market[]>(MOCK_MARKETS);
  const [bets, setBets] = useState<Bet[]>(MOCK_BETS);
  const [transactions, setTransactions] =
    useState<Transaction[]>(MOCK_TRANSACTIONS);
  const [priceHistory] =
    useState<Record<string, PricePoint[]>>(MOCK_PRICE_HISTORY);

  const addMarket = useCallback(
    (req: CreateMarketRequest): Market => {
      const id = `market-${nextMarketSeq++}`;
      const now = new Date().toISOString();
      const market: Market = {
        id,
        title: req.title,
        description: req.description,
        creator_id: user.id,
        created_at: now,
        close_at: req.close_at,
        status: "open",
        resolution_criteria: req.resolution_criteria,
        category: req.category ?? "General",
        yes_pool_total: 0,
        no_pool_total: 0,
        resolved_outcome: null,
        resolved_at: null,
      };
      setMarkets((prev) => [market, ...prev]);
      return market;
    },
    [user.id],
  );

  const placeBet = useCallback(
    (marketId: string, side: BetSide, amount: number): Bet => {
      if (amount <= 0) throw new Error("Bet amount must be positive");
      if (amount > user.banana_balance)
        throw new Error("Insufficient banana balance");

      const now = new Date().toISOString();
      const betId = `bet-${nextBetSeq++}`;
      const txId = `tx-${nextTxSeq++}`;

      const bet: Bet = {
        id: betId,
        user_id: user.id,
        market_id: marketId,
        side,
        amount,
        created_at: now,
      };

      const tx: Transaction = {
        id: txId,
        user_id: user.id,
        market_id: marketId,
        transaction_type: "bet_placement",
        amount: -amount,
        created_at: now,
      };

      setMarkets((prev) =>
        prev.map((m) => {
          if (m.id !== marketId) return m;
          return side === "YES"
            ? { ...m, yes_pool_total: m.yes_pool_total + amount }
            : { ...m, no_pool_total: m.no_pool_total + amount };
        }),
      );

      setBets((prev) => [bet, ...prev]);
      setTransactions((prev) => [tx, ...prev]);
      updateBalance(-amount);

      return bet;
    },
    [user.id, user.banana_balance, updateBalance],
  );

  const value = useMemo(
    () => ({ markets, bets, transactions, priceHistory, addMarket, placeBet }),
    [markets, bets, transactions, priceHistory, addMarket, placeBet],
  );

  return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>;
}
