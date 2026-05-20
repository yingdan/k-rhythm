import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Box,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { EmojiEvents } from '@mui/icons-material';
import { statisticsApi, LeaderboardEntry } from '../api/statistics';

export const Leaderboard: React.FC = () => {
  const [period, setPeriod] = useState<string>('all');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [_, setLoading] = useState(false);

  useEffect(() => {
    fetchLeaderboard();
  }, [period]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const res = await statisticsApi.getLeaderboard({
        period,
        limit: 50,
      });
      setLeaderboard(res.data);
    } catch (error) {
      // 使用模拟数据
      setLeaderboard(generateMockLeaderboard());
    } finally {
      setLoading(false);
    }
  };

  const generateMockLeaderboard = (): LeaderboardEntry[] => {
    const names = ['张三', '李四', '王五', '赵六', '钱七', '孙八', '周九', '吴十'];
    return names.map((name, index) => ({
      rank: index + 1,
      username: name,
      total_pnl: Math.random() * 50000 - 10000,
      win_rate: 0.3 + Math.random() * 0.5,
      total_trades: Math.floor(Math.random() * 100) + 10,
    })).sort((a, b) => b.total_pnl - a.total_pnl).map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return rank;
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box display="flex" alignItems="center" gap={2} mb={4}>
        <EmojiEvents color="primary" sx={{ fontSize: 40 }} />
        <Typography variant="h4">排行榜</Typography>
      </Box>

      {/* 周期选择 */}
      <Box mb={3}>
        <ToggleButtonGroup
          value={period}
          exclusive
          onChange={(_, v) => { if (v) setPeriod(v); }}
        >
          <ToggleButton value="all">全部</ToggleButton>
          <ToggleButton value="weekly">本周</ToggleButton>
          <ToggleButton value="monthly">本月</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* 排行榜表格 */}
      <Paper sx={{ bgcolor: 'background.paper' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>排名</TableCell>
                <TableCell>用户名</TableCell>
                <TableCell align="right">总盈亏</TableCell>
                <TableCell align="right">胜率</TableCell>
                <TableCell align="right">交易次数</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {leaderboard.map((entry) => (
                <TableRow
                  key={entry.username}
                  sx={{
                    bgcolor: entry.rank <= 3 ? 'action.hover' : 'inherit',
                  }}
                >
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="h6">
                        {getRankIcon(entry.rank)}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography fontWeight={entry.rank <= 3 ? 'bold' : 'normal'}>
                      {entry.username}
                    </Typography>
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      color: entry.total_pnl >= 0 ? 'success.main' : 'error.main',
                      fontWeight: 'bold',
                    }}
                  >
                    ¥{entry.total_pnl.toFixed(2)}
                  </TableCell>
                  <TableCell align="right">
                    <Chip
                      label={`${(entry.win_rate * 100).toFixed(1)}%`}
                      size="small"
                      color={entry.win_rate >= 0.5 ? 'success' : 'error'}
                    />
                  </TableCell>
                  <TableCell align="right">{entry.total_trades}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Container>
  );
};
