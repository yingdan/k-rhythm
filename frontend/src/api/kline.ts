import apiClient from './client';

export interface KlineBar {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface KlineResponse {
  bars: KlineBar[];
  total: number;
  symbol_code: string;
}

export const klineApi = {
  getKline: (symbolCode: string, params?: {
    period?: string;
    start_date?: string;
    end_date?: string;
    limit?: number;
  }) =>
    apiClient.get<KlineResponse>(`/kline/${symbolCode}`, { params }),

  getBar: (symbolCode: string, index: number) =>
    apiClient.get<KlineBar>(`/kline/${symbolCode}/bar/${index}`),
};
