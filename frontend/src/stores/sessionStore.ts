import { create } from 'zustand';
import type { UsEvent } from '../types/api';

export interface KlineBar {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface SessionState {
  sessionId: string | null;
  symbolId: number | null;
  symbolCode: string | null;
  currentIndex: number;  // 下一根待决策K线的索引
  status: 'idle' | 'training' | 'completed';
  currentBar: KlineBar | null;
  revealedBars: KlineBar[];  // 已显示的K线（历史+已决策）
  events: UsEvent[];  // 美股事件

  setSession: (sessionId: string, symbolId: number, symbolCode: string, initialHistoryBars?: KlineBar[]) => void;
  nextBar: (bar: KlineBar) => void;
  setEvents: (events: UsEvent[]) => void;
  completeSession: () => void;
  reset: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  sessionId: null,
  symbolId: null,
  symbolCode: null,
  currentIndex: 0,
  status: 'idle',
  currentBar: null,
  revealedBars: [],
  events: [],

  // 设置会话和初始历史K线（不增加 currentIndex）
  setSession: (sessionId, symbolId, symbolCode, initialHistoryBars = []) => set({
    sessionId,
    symbolId,
    symbolCode,
    currentIndex: initialHistoryBars.length,  // 下一根K线从历史数据之后开始
    status: 'training',
    currentBar: initialHistoryBars.length > 0 ? initialHistoryBars[initialHistoryBars.length - 1] : null,
    revealedBars: initialHistoryBars,  // 历史K线作为初始已显示K线
  }),

  // 添加一根决策K线（同时增加 currentIndex）
  nextBar: (bar) => set((state) => ({
    currentIndex: state.currentIndex + 1,
    currentBar: bar,
    revealedBars: [...state.revealedBars, bar],
  })),

  // 设置事件数据
  setEvents: (events) => set({ events }),

  completeSession: () => set({ status: 'completed' }),

  reset: () => set({
    sessionId: null,
    symbolId: null,
    symbolCode: null,
    currentIndex: 0,
    status: 'idle',
    currentBar: null,
    revealedBars: [],
    events: [],
  }),
}));
