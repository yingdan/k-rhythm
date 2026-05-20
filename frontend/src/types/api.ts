// API 通用类型定义

export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ErrorResponse {
  code: number;
  message: string;
  details?: string;
}

// 用户相关类型
export interface User {
  id: string;
  username: string;
  email: string;
  created_at?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

// 股票品种类型
export interface Symbol {
  id: number;
  code: string;
  name: string;
  market: string;
  type: string;
  data_source?: string;
}

// K线相关类型
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
  period?: string;
}

// 训练场次类型
export type SessionStatus = 'idle' | 'training' | 'completed';

export interface Session {
  id: string;
  user_id: string;
  symbol_id: number;
  symbol_code: string;
  period: string;
  mode: string;
  status: SessionStatus;
  current_index: number;
  start_date: string;
  end_date: string;
  created_at: string;
  completed_at?: string;
}

export interface CreateSessionRequest {
  symbol_id: number;
  period: string;
  mode: string;
  start_date: string;
  end_date: string;
}

export interface NextBarResponse {
  bar: KlineBar;
  session: Session;
}

// 交易相关类型
export type TradeDirection = 'long' | 'short';
export type TradeStatus = 'open' | 'closed';

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
  status: TradeStatus;
  opened_at: string;
  closed_at?: string;
}

export interface OpenTradeRequest {
  session_id: string;
  direction: TradeDirection;
  quantity: number;
  entry_price?: number;
  stop_loss?: number;
  take_profit?: number;
}

export interface CloseTradeRequest {
  exit_price: number;
  quantity?: number;
}

// 统计数据类型
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
  trades_by_date?: Array<{
    date: string;
    pnl: number;
  }>;
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  total_pnl: number;
  win_rate: number;
  total_trades: number;
  average_pnl?: number;
}

// 美股事件类型
export type UsEventType = 'earnings' | 'fed' | 'economic' | 'split' | 'dividend' | 'corporate' | 'macro';
export type EventImpact = 'positive' | 'negative' | 'neutral';

export interface UsEvent {
  date: string;
  symbol: string;
  type: UsEventType;
  title: string;
  description: string;
  impact: EventImpact;
  price_reaction?: string;
}

export interface EventsResponse {
  events: UsEvent[];
  total: number;
  symbol?: string;
  start?: string;
  end?: string;
}

export interface EventTypeInfo {
  type: UsEventType;
  count: number;
}

// 美股股票信息
export interface UsStockInfo {
  code: string;
  name: string;
  sector: string;
}

// 通用工具类型
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type Maybe<T> = T | null | undefined;
