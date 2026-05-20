import { useState, useEffect } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { sessionsApi, Session } from '../api/sessions';

export const useSession = () => {
  const {
    sessionId,
    status,
    currentIndex,
    setSession,
    nextBar,
    completeSession,
    reset,
  } = useSessionStore();

  const [session, setSessionData] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const createSession = async (symbolId: number, symbolCode: string, period = 'daily') => {
    setLoading(true);
    setError('');

    try {
      const now = new Date();
      const startDate = new Date(now);
      startDate.setFullYear(startDate.getFullYear() - 1);

      const response = await sessionsApi.create({
        symbol_id: symbolId,
        period,
        mode: 'sequential',
        start_date: startDate.toISOString().split('T')[0],
        end_date: now.toISOString().split('T')[0],
      });

      setSessionData(response.data);
      setSession(response.data.id, symbolId, symbolCode);
      return { success: true, session: response.data };
    } catch (err: any) {
      setError(err.response?.data?.message || '创建训练场次失败');
      // 使用模拟session
      setSession('mock-session', symbolId, symbolCode);
      return { success: true, session: null };
    } finally {
      setLoading(false);
    }
  };

  const fetchSession = async (id: string) => {
    setLoading(true);
    try {
      const response = await sessionsApi.get(id);
      setSessionData(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || '获取训练场次失败');
    } finally {
      setLoading(false);
    }
  };

  const advanceBar = async () => {
    if (!sessionId) return;

    try {
      const response = await sessionsApi.nextBar(sessionId);
      nextBar(response.data.bar);
      return { success: true };
    } catch (err: any) {
      setError(err.response?.data?.message || '获取下一根K线失败');
      return { success: false };
    }
  };

  const complete = async () => {
    if (!sessionId) return;

    try {
      await sessionsApi.complete(sessionId);
    } catch {
      // 模拟完成
    }
    completeSession();
  };

  // 获取交易历史
  const fetchTrades = async () => {
    if (!sessionId) return;

    try {
      await sessionsApi.get(sessionId);
      // 处理交易数据
    } catch {
      // 忽略错误
    }
  };

  useEffect(() => {
    if (sessionId) {
      fetchTrades();
    }
  }, [sessionId]);

  return {
    sessionId,
    status,
    currentIndex,
    session,
    loading,
    error,
    createSession,
    fetchSession,
    advanceBar,
    complete,
    reset,
  };
};
