import apiClient from './client';

export interface CreateSessionRequest {
  symbol_id: number;
  period: string;
  mode: string;
  start_date: string;
  end_date: string;
}

export interface Session {
  id: string;
  user_id: string;
  symbol_id: number;
  symbol_code: string;
  period: string;
  mode: string;
  status: 'idle' | 'training' | 'completed';
  current_index: number;
  start_date: string;
  end_date: string;
  created_at: string;
}

export interface NextBarResponse {
  bar: {
    timestamp: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  };
  session: Session;
}

export const sessionsApi = {
  create: (data: CreateSessionRequest) =>
    apiClient.post<Session>('/sessions/', data),

  get: (id: string) =>
    apiClient.get<Session>(`/sessions/${id}`),

  list: (params?: { status?: string }) =>
    apiClient.get<Session[]>('/sessions/', { params }),

  nextBar: (id: string) =>
    apiClient.post<NextBarResponse>(`/sessions/${id}/next`),

  complete: (id: string) =>
    apiClient.post<Session>(`/sessions/${id}/complete`),

  getSummary: (id: string) =>
    apiClient.get(`/sessions/${id}/summary`),
};
