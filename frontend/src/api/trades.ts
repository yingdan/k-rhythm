import apiClient from './client';

export type TradeDirection = 'buy' | 'sell' | 'long' | 'short';

export interface OpenTradeRequest {
  session_id: string;
  direction: TradeDirection;
  quantity: number;
  entry_price?: number;
}

export interface CloseTradeRequest {
  exit_price: number;
  quantity?: number;
}

export interface Trade {
  id: string;
  session_id: string;
  direction: TradeDirection;
  quantity: number;
  entry_price: number;
  exit_price?: number;
  pnl?: number;
  status: 'open' | 'closed';
  opened_at: string;
  closed_at?: string;
}

export const tradesApi = {
  openTrade: (data: OpenTradeRequest) =>
    apiClient.post<Trade>('/trades/', data),

  closeTrade: (id: string, data: CloseTradeRequest) =>
    apiClient.post<Trade>(`/trades/${id}/close`, data),

  getActive: (sessionId: string) =>
    apiClient.get<Trade[]>('/trades/active', { params: { session_id: sessionId } }),

  getHistory: (sessionId: string) =>
    apiClient.get<Trade[]>('/trades/', { params: { session_id: sessionId } }),
};
