import apiClient from './client';

export interface Symbol {
  id: number;
  code: string;
  name: string;
  market: string;
  type: string;
}

export interface SymbolListResponse {
  items: Symbol[];
  total: number;
}

export const symbolsApi = {
  getList: (params: { market?: string; search?: string; page?: number; pageSize?: number }) =>
    apiClient.get<SymbolListResponse>('/symbols/', { params }),

  getPopular: (market: string) =>
    apiClient.get<Symbol[]>('/symbols/popular', { params: { market } }),

  getDetail: (code: string) =>
    apiClient.get<Symbol>(`/symbols/${code}`),
};
