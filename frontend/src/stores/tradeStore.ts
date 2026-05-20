import { create } from 'zustand';

export type TradeDirection = 'buy' | 'sell' | 'long' | 'short';

export interface Trade {
  id: string;
  session_id: string;
  direction: TradeDirection;
  quantity: number;
  entry_price: number;
  exit_price?: number;
  stop_loss?: number;
  take_profit?: number;
  pnl?: number;
  status: 'open' | 'closed';
  opened_at: string;
  closed_at?: string;
}

interface TradeState {
  currentTrade: Trade | null;
  tradeHistory: Trade[];
  totalPnl: number;

  openTrade: (trade: Trade) => void;
  closeTrade: (exitPrice: number, pnl: number) => void;
  setTradeHistory: (trades: Trade[]) => void;
  reset: () => void;
}

export const useTradeStore = create<TradeState>((set) => ({
  currentTrade: null,
  tradeHistory: [],
  totalPnl: 0,

  openTrade: (trade) => set({
    currentTrade: trade,
    tradeHistory: [],
  }),

  closeTrade: (exitPrice, pnl) => set((state) => {
    if (!state.currentTrade) return state;

    const closedTrade: Trade = {
      ...state.currentTrade,
      exit_price: exitPrice,
      pnl,
      status: 'closed',
      closed_at: new Date().toISOString(),
    };

    return {
      currentTrade: null,
      tradeHistory: [...state.tradeHistory, closedTrade],
      totalPnl: state.totalPnl + pnl,
    };
  }),

  setTradeHistory: (trades) => set({
    tradeHistory: trades,
    totalPnl: trades.reduce((sum, t) => sum + (t.pnl || 0), 0),
  }),

  reset: () => set({
    currentTrade: null,
    tradeHistory: [],
    totalPnl: 0,
  }),
}));
