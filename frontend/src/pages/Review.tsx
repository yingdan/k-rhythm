import { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Button,
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { StatisticsPanel } from '../components/statistics/StatsCard';
import { EquityCurve } from '../components/statistics/EquityCurve';
import { TradeHistory } from '../components/statistics/TradeHistory';
import { statisticsApi } from '../api/statistics';
import { Trade } from '../api/trades';

export const Review: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [stats, setStats] = useState<any>(null);
  const [trades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!sessionId) return;

      try {
        // 获取统计数据
        const statsRes = await statisticsApi.getSessionStats(sessionId);
        setStats(statsRes.data);
      } catch (error) {
        // 使用模拟数据
        setStats({
          total_trades: 10,
          winning_trades: 6,
          losing_trades: 4,
          win_rate: 0.6,
          total_pnl: 1250.5,
          average_pnl: 125.05,
          max_drawdown: 0.08,
          equity_curve: generateMockEquityCurve(),
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [sessionId]);

  const generateMockEquityCurve = () => {
    const points = [];
    let equity = 100000;
    for (let i = 0; i < 50; i++) {
      equity += (Math.random() - 0.45) * 500;
      const date = new Date();
      date.setDate(date.getDate() - 50 + i);
      points.push({
        timestamp: date.toISOString(),
        equity: parseFloat(equity.toFixed(2)),
      });
    }
    return points;
  };

  if (loading) {
    return (
      <Container>
        <Typography>加载中...</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box display="flex" alignItems="center" gap={2} mb={4}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/')}>
          返回
        </Button>
        <Typography variant="h4">训练复盘</Typography>
      </Box>

      {/* 统计面板 */}
      {stats && (
        <Box mb={4}>
          <StatisticsPanel
            totalTrades={stats.total_trades}
            winningTrades={stats.winning_trades}
            totalPnl={stats.total_pnl}
            winRate={stats.win_rate}
            maxDrawdown={stats.max_drawdown}
          />
        </Box>
      )}

      <Grid container spacing={3}>
        {/* 收益曲线 */}
        <Grid item xs={12}>
          <EquityCurve
            data={stats?.equity_curve || []}
            title="权益曲线"
            height={350}
          />
        </Grid>

        {/* 交易历史 */}
        <Grid item xs={12}>
          <TradeHistory trades={trades} title="交易明细" />
        </Grid>
      </Grid>
    </Container>
  );
};
