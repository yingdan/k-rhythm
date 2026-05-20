import { Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip } from '@mui/material';
import { TrendingUp, TrendingDown } from '@mui/icons-material';
import { Trade } from '../../api/trades';

interface TradeHistoryProps {
  trades: Trade[];
  title?: string;
}

export const TradeHistory: React.FC<TradeHistoryProps> = ({
  trades,
  title = '交易历史',
}) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatPrice = (price: number) => {
    return price.toFixed(2);
  };

  return (
    <Paper sx={{ p: 2, bgcolor: 'background.paper' }}>
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>

      {trades.length === 0 ? (
        <Typography variant="body2" color="text.secondary" align="center" py={4}>
          暂无交易记录
        </Typography>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>方向</TableCell>
                <TableCell align="right">开仓价</TableCell>
                <TableCell align="right">平仓价</TableCell>
                <TableCell align="right">数量</TableCell>
                <TableCell align="right">盈亏</TableCell>
                <TableCell align="right">时间</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {trades.map((trade) => (
                <TableRow key={trade.id} hover>
                  <TableCell>
                    <Chip
                      icon={trade.direction === 'long' ? <TrendingUp /> : <TrendingDown />}
                      label={trade.direction === 'long' ? '做多' : '做空'}
                      size="small"
                      color={trade.direction === 'long' ? 'success' : 'error'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    {formatPrice(trade.entry_price)}
                  </TableCell>
                  <TableCell align="right">
                    {trade.exit_price ? formatPrice(trade.exit_price) : '-'}
                  </TableCell>
                  <TableCell align="right">{trade.quantity}</TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      color: trade.pnl && trade.pnl >= 0 ? 'success.main' : 'error.main',
                      fontWeight: 'bold',
                    }}
                  >
                    {trade.pnl ? trade.pnl.toFixed(2) : '-'}
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(trade.opened_at)}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Paper>
  );
};
