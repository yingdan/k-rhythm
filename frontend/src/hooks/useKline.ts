import { useState, useEffect, useCallback } from 'react';
import { KlineBar } from '../api/kline';
import { klineApi } from '../api/kline';

export interface UseKlineOptions {
  symbolCode: string;
  period?: string;
  autoFetch?: boolean;
}

export const useKline = (options: UseKlineOptions) => {
  const { symbolCode, period = 'daily', autoFetch = true } = options;

  const [bars, setBars] = useState<KlineBar[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchKline = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await klineApi.getKline(symbolCode, { period });
      setBars(response.data.bars || []);
    } catch (err: any) {
      setError(err.response?.data?.message || '获取K线数据失败');
      // 使用模拟数据
      setBars(generateMockBars(symbolCode));
    } finally {
      setLoading(false);
    }
  }, [symbolCode, period]);

  useEffect(() => {
    if (autoFetch && symbolCode) {
      fetchKline();
    }
  }, [symbolCode, period, autoFetch, fetchKline]);

  return {
    bars,
    loading,
    error,
    refetch: fetchKline,
  };
};

// 生成模拟K线数据
const generateMockBars = (symbolCode: string): KlineBar[] => {
  const bars: KlineBar[] = [];
  let price = symbolCode.includes('600519') ? 1800 : 100;
  const now = new Date();

  for (let i = 100; i >= 0; i--) {
    const timestamp = new Date(now);
    timestamp.setDate(timestamp.getDate() - i);

    const change = (Math.random() - 0.48) * price * 0.02;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * price * 0.01;
    const low = Math.min(open, close) - Math.random() * price * 0.01;

    bars.push({
      timestamp: timestamp.toISOString(),
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume: Math.floor(Math.random() * 1000000),
    });

    price = close;
  }

  return bars;
};
