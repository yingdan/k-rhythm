import apiClient from './client';

export interface Statistics {
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate: number;
  total_pnl: number;
  average_pnl: number;
  max_drawdown: number;
  sharpe_ratio?: number;
  equity_curve: Array<{
    timestamp: string;
    equity: number;
  }>;
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  total_pnl: number;
  win_rate: number;
  total_trades: number;
}

export const statisticsApi = {
  getSessionStats: (sessionId: string) =>
    apiClient.get<Statistics>(`/statistics/session/${sessionId}`),

  getUserStats: () =>
    apiClient.get<Statistics>('/statistics/user'),

  getLeaderboard: (params?: { period?: string; limit?: number }) =>
    apiClient.get<LeaderboardEntry[]>('/statistics/leaderboard', { params }),
};
