import { Paper, Typography, Box, Chip, Divider } from '@mui/material';
import { TrendingUp, TrendingDown } from '@mui/icons-material';
import { useSessionStore } from '../../stores/sessionStore';
import { useTradeStore } from '../../stores/tradeStore';

export const PositionPanel: React.FC = () => {
  const { currentBar } = useSessionStore();
  const { currentTrade, tradeHistory } = useTradeStore();

  return (
    <Paper sx={{ p: 2, bgcolor: 'background.paper' }}>
      <Typography variant="h6" gutterBottom>
        持仓详情
      </Typography>

      {/* 当前持仓 */}
      {currentTrade ? (
        <Box>
          <Box display="flex" alignItems="center" gap={1} mb={2}>
            {currentTrade.direction === 'long' ? (
              <Chip icon={<TrendingUp />} label="做多" color="success" />
            ) : (
              <Chip icon={<TrendingDown />} label="做空" color="error" />
            )}
          </Box>

          <Box display="flex" justifyContent="space-between" mb={1}>
            <Typography variant="body2" color="text.secondary">
              开仓价
            </Typography>
            <Typography variant="body2">
              {currentTrade.entry_price.toFixed(2)}
            </Typography>
          </Box>

          <Box display="flex" justifyContent="space-between" mb={1}>
            <Typography variant="body2" color="text.secondary">
              数量
            </Typography>
            <Typography variant="body2">
              {currentTrade.quantity} 手
            </Typography>
          </Box>

          <Divider sx={{ my: 1 }} />

          {/* 当前盈亏 */}
          <Box display="flex" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">
              浮动盈亏
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: currentBar && currentTrade
                  ? (currentBar.close - currentTrade.entry_price) * (currentTrade.direction === 'long' ? 1 : -1) >= 0
                    ? 'success.main'
                    : 'error.main'
                  : 'text.primary',
                fontWeight: 'bold',
              }}
            >
              {currentBar && currentTrade
                ? ((currentBar.close - currentTrade.entry_price) * (currentTrade.direction === 'long' ? 1 : -1) * currentTrade.quantity).toFixed(2)
                : '0.00'}
            </Typography>
          </Box>
        </Box>
      ) : (
        <Typography variant="body2" color="text.secondary" align="center">
          当前无持仓
        </Typography>
      )}

      {/* 历史交易统计 */}
      {tradeHistory.length > 0 && (
        <Box mt={2}>
          <Divider sx={{ mb: 1 }} />
          <Typography variant="subtitle2" gutterBottom>
            本次交易
          </Typography>
          {tradeHistory.slice(-5).reverse().map((trade) => (
            <Box
              key={trade.id}
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              py={0.5}
            >
              <Chip
                label={trade.direction === 'long' ? '多' : '空'}
                size="small"
                color={trade.direction === 'long' ? 'success' : 'error'}
              />
              <Typography variant="caption" color="text.secondary">
                {trade.entry_price.toFixed(2)} → {trade.exit_price?.toFixed(2)}
              </Typography>
              <Typography
                variant="caption"
                color={trade.pnl && trade.pnl >= 0 ? 'success.main' : 'error.main'}
              >
                {trade.pnl?.toFixed(2)}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Paper>
  );
};
