import { Paper, Typography, Box, Grid } from '@mui/material';
import { TrendingUp, TrendingDown, ShowChart, BarChart } from '@mui/icons-material';

interface StatsCardProps {
  title: string;
  value: number | string;
  icon?: React.ReactNode;
  color?: 'success' | 'error' | 'primary' | 'warning';
  prefix?: string;
  suffix?: string;
}

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  icon,
  color = 'primary',
  prefix = '',
  suffix = '',
}) => {
  return (
    <Paper sx={{ p: 2, height: '100%' }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
        <Typography variant="body2" color="text.secondary">
          {title}
        </Typography>
        {icon && <Box color={`${color}.main`}>{icon}</Box>}
      </Box>
      <Typography variant="h4" color={`${color}.main`} fontWeight="bold">
        {prefix}{typeof value === 'number' ? value.toFixed(2) : value}{suffix}
      </Typography>
    </Paper>
  );
};

// 统计面板组合组件
interface StatisticsPanelProps {
  totalTrades: number;
  winningTrades: number;
  totalPnl: number;
  winRate: number;
  maxDrawdown: number;
}

export const StatisticsPanel: React.FC<StatisticsPanelProps> = ({
  totalTrades,
  totalPnl,
  winRate,
  maxDrawdown,
}) => {
  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        交易统计
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={6} md={3}>
          <StatsCard
            title="总交易次数"
            value={totalTrades}
            icon={<BarChart />}
            color="primary"
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatsCard
            title="胜率"
            value={winRate * 100}
            suffix="%"
            icon={<TrendingUp />}
            color={winRate >= 0.5 ? 'success' : 'error'}
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatsCard
            title="总盈亏"
            value={totalPnl}
            prefix="¥"
            icon={totalPnl >= 0 ? <TrendingUp /> : <TrendingDown />}
            color={totalPnl >= 0 ? 'success' : 'error'}
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatsCard
            title="最大回撤"
            value={maxDrawdown * 100}
            suffix="%"
            icon={<ShowChart />}
            color={maxDrawdown <= 0.1 ? 'success' : 'error'}
          />
        </Grid>
      </Grid>
    </Box>
  );
};
