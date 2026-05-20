import apiClient from './client';
import type { ApiResponse, EventsResponse } from '../types/api';

export const eventsApi = {
  getStockEvents: async (symbol: string): Promise<EventsResponse> => {
    const res: ApiResponse<EventsResponse> = await apiClient.get(
      `/us-events/${encodeURIComponent(symbol.replace('.US', ''))}`
    );
    return res.data;
  },

  getMacroEvents: async (): Promise<EventsResponse> => {
    const res: ApiResponse<EventsResponse> = await apiClient.get('/us-events/macro');
    return res.data;
  },

  getEventsInRange: async (
    start: string,
    end: string,
    symbol?: string
  ): Promise<EventsResponse> => {
    const params: Record<string, string> = { start, end };
    if (symbol) {
      params.symbol = symbol.replace('.US', '');
    }
    const res: ApiResponse<EventsResponse> = await apiClient.get('/us-events/range', { params });
    return res.data;
  },

  getEventTypes: async (): Promise<{ types: Array<{ type: string; count: number }> }> => {
    const res: ApiResponse<{ types: Array<{ type: string; count: number }> }> =
      await apiClient.get('/us-events/types');
    return res.data;
  },
};
