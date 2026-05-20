import { Box, Button, Typography, Paper, Chip, Collapse } from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  AccountBalanceWallet,
  RemoveCircleOutline,
  Campaign,
  KeyboardArrowDown,
  KeyboardArrowUp,
} from '@mui/icons-material';
import { useEffect, useState, useMemo } from 'react';
import { useSessionStore } from '../../stores/sessionStore';
import type { UsEvent } from '../../types/api';

interface PanelBar {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface TradePanelProps {
  onOpenPosition: (
    direction: 'buy' | 'sell' | 'long' | 'short',
    quantity: number,
  ) => boolean | Promise<boolean>;
  onNextBar: () => boolean | Promise<boolean>;
  onHoldDecision?: () => boolean | Promise<boolean>;
  currentPrice?: number;
  decisionBar?: PanelBar;
  symbolCode?: string;
  initialCapital: number;
  availableCapital: number;
  positionShares?: number;
  positionCost?: number;
  /** 美股事件数据 */
  events?: UsEvent[];
  /** 当前决策K线的日期，用于匹配事件 */
  currentBarDate?: string;
}

type PositionSize = '1/4' | '1/3' | '1/2' | 'full';

export const TradePanel: React.FC<TradePanelProps> = ({
  onOpenPosition,
  onNextBar,
  onHoldDecision,
  currentPrice,
  decisionBar,
  symbolCode = '',
  initialCapital,
  availableCapital,
  positionShares = 0,
  positionCost = 0,
  events = [],
  currentBarDate,
}) => {
  const isAStock = symbolCode.includes('.SH') || symbolCode.includes('.SZ');
  const hasPosition = positionShares > 0;

  // 当前K线日期匹配的事件
  const currentEvents = useMemo(() => {
    if (!currentBarDate || events.length === 0) return [];
    const barDate = currentBarDate.split('T')[0];
    return events.filter((evt) => {
      const evtDate = evt.date;
      const diff = Math.abs(new Date(barDate).getTime() - new Date(evtDate + 'T00:00:00').getTime());
      // 前后2天内的事件都算相关
      return diff <= 2 * 24 * 60 * 60 * 1000;
    });
  }, [events, currentBarDate]);

  const [eventsExpanded, setEventsExpanded] = useState(false);

  const [positionSize, setPositionSize] = useState<PositionSize>('1/2');
  const [capitalInfo, setCapitalInfo] = useState({
    amount: initialCapital || 100000,
    unit: 'cny' as 'cny' | 'usd',
  });
  const { currentBar } = useSessionStore();

  useEffect(() => {
    const stored = sessionStorage.getItem('training_capital');
    if (!stored) return;

    try {
      const info = JSON.parse(stored);
      setCapitalInfo(info);
    } catch {
      // Keep defaults when stored settings are malformed.
    }
  }, []);

  /** 与品种一致：沪深 → 人民币，否则美元 */
  useEffect(() => {
    const isA = symbolCode.includes('.SH') || symbolCode.includes('.SZ');
    const nextUnit = isA ? 'cny' : 'usd';
    setCapitalInfo((prev) => {
      const next = { ...prev, unit: nextUnit as 'cny' | 'usd' };
      try {
        sessionStorage.setItem('training_capital', JSON.stringify(next));
      } catch {
        // ignore quota / privacy mode
      }
      return next;
    });
  }, [symbolCode]);

  useEffect(() => {
    setCapitalInfo((prev) => ({ ...prev, amount: availableCapital }));
  }, [availableCapital]);

  const activeBar = decisionBar || currentBar;
  const price = currentPrice || activeBar?.close || 0;
  const hasValidData = price > 0;
  const unitSymbol = capitalInfo.unit === 'usd' ? '$' : '¥';

  const getPositionRatio = () => {
    const ratio: Record<PositionSize, number> = {
      '1/4': 0.25,
      '1/3': 0.333,
      '1/2': 0.5,
      full: 1,
    };
    return ratio[positionSize];
  };

  const calculateQuantity = (direction: 'buy' | 'sell' | 'long' | 'short') => {
    if (!price) return 0;
    const ratio = getPositionRatio();

    // 卖：基于持仓数量计算
    if (direction === 'sell') {
      return Math.floor(positionShares * ratio);
    }

    // 买：基于可用资金计算
    return Math.floor((capitalInfo.amount * ratio) / price);
  };

  // 持仓市值
  const currentPositionValue = positionShares * price;

  // 持仓成本均价
  const averageCost = positionShares > 0 ? positionCost / positionShares : 0;

  // 浮动盈亏
  const floatingPnl = hasPosition ? (price - averageCost) * positionShares : 0;

  const handleDecision = async (direction: 'buy' | 'sell') => {
    const qty = calculateQuantity(direction);
    if (qty <= 0) return;

    const success = await onOpenPosition(direction, qty);
    if (success) {
      onNextBar();
    }
  };

  const handleHold = async () => {
    const advanced = await onNextBar();
    if (advanced !== false && onHoldDecision) {
      await onHoldDecision();
    }
  };

  const formatDate = (timestamp?: string) => {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleDateString();
  };

  const previewBuyQty = calculateQuantity('buy');
  const previewSellQty = calculateQuantity('sell');
  const previewBuyAmount = previewBuyQty * price;

  return (
    <Paper sx={{ p: 2, bgcolor: 'background.paper', height: '100%', overflow: 'hidden' }}>
      <Typography variant="h6" gutterBottom>
        {isAStock ? '决策面板' : '交易面板'}
      </Typography>

      {/* 资金概览 */}
      <Box sx={{ mb: 2, p: 1.5, bgcolor: 'primary.dark', borderRadius: 1 }}>
        <Box display="flex" alignItems="center" gap={0.5} mb={1}>
          <AccountBalanceWallet fontSize="small" />
          <Typography variant="caption" color="text.secondary">
            资金概览
          </Typography>
        </Box>

        <Box display="grid" gridTemplateColumns="repeat(2, 1fr)" gap={1}>
          <Box>
            <Typography variant="caption" color="text.secondary">训练本金</Typography>
            <Typography variant="body2" color="primary">
              {unitSymbol}{initialCapital.toLocaleString()}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">可用余额</Typography>
            <Typography variant="body2" color="success.main">
              {unitSymbol}{availableCapital.toLocaleString()}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">持仓</Typography>
            <Typography variant="body2">{positionShares.toLocaleString()} 股</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">持仓市值</Typography>
            <Typography variant="body2">{unitSymbol}{currentPositionValue.toFixed(2)}</Typography>
          </Box>
          {hasPosition && (
            <>
              <Box>
                <Typography variant="caption" color="text.secondary">持仓均价</Typography>
                <Typography variant="body2">{unitSymbol}{averageCost.toFixed(2)}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">浮动盈亏</Typography>
                <Typography variant="body2" color={floatingPnl >= 0 ? 'success.main' : 'error.main'}>
                  {floatingPnl >= 0 ? '+' : ''}{floatingPnl.toFixed(2)} {unitSymbol}
                </Typography>
              </Box>
            </>
          )}
        </Box>
      </Box>

      {/* 当前K线信息 */}
      <Box sx={{ mb: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
          <Typography variant="body2" color="text.secondary">
            待决策收盘价
          </Typography>
          <Typography
            variant="h5"
            color={activeBar && activeBar.close >= activeBar.open ? 'success.main' : 'error.main'}
          >
            {price.toFixed(2)}
          </Typography>
        </Box>
        <Box display="flex" justifyContent="space-between">
          <Typography variant="caption" color="text.secondary">日期</Typography>
          <Typography variant="caption">{formatDate(activeBar?.timestamp)}</Typography>
        </Box>
        {activeBar && (
          <Box display="grid" gridTemplateColumns="repeat(4, 1fr)" gap={0.5} mt={1}>
            <Chip size="small" label={`开 ${activeBar.open.toFixed(2)}`} />
            <Chip size="small" label={`高 ${activeBar.high.toFixed(2)}`} />
            <Chip size="small" label={`低 ${activeBar.low.toFixed(2)}`} />
            <Chip size="small" label={`收 ${activeBar.close.toFixed(2)}`} />
          </Box>
        )}
      </Box>

      {/* 仓位选择 */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          仓位设置
        </Typography>
        <Box display="flex" gap={0.5} flexWrap="wrap">
          {(['1/4', '1/3', '1/2', 'full'] as PositionSize[]).map((size) => (
            <Button
              key={size}
              size="small"
              variant={positionSize === size ? 'contained' : 'outlined'}
              onClick={() => setPositionSize(size)}
              sx={{ flex: 1, minWidth: '45px', fontSize: '0.75rem', py: 0.5 }}
            >
              {size === 'full' ? '全仓' : size}
            </Button>
          ))}
        </Box>
        <Box display="flex" justifyContent="space-between" mt={1}>
          <Typography variant="caption" color="text.secondary">
            买入预估
          </Typography>
          <Typography variant="body2">
            {previewBuyQty} 股 / {unitSymbol}{previewBuyAmount.toFixed(2)}
          </Typography>
        </Box>
        {hasPosition && (
          <Box display="flex" justifyContent="space-between">
            <Typography variant="caption" color="text.secondary">
              卖出预估
            </Typography>
            <Typography variant="body2">
              {previewSellQty} 股 / {unitSymbol}{(previewSellQty * price).toFixed(2)}
            </Typography>
          </Box>
        )}
      </Box>

      {/* 当前K线匹配的事件（美股） */}
      {!isAStock && currentEvents.length > 0 && (
        <Box sx={{ mb: 2, p: 1, bgcolor: 'warning.dark', borderRadius: 1, border: '1px solid', borderColor: 'warning.main' }}>
          <Box
            display="flex"
            alignItems="center"
            gap={0.5}
            sx={{ cursor: 'pointer' }}
            onClick={() => setEventsExpanded(!eventsExpanded)}
          >
            <Campaign fontSize="small" sx={{ color: 'warning.main' }} />
            <Typography variant="caption" sx={{ color: 'warning.main', fontWeight: 600 }}>
              当日事件 ({currentEvents.length})
            </Typography>
            <Box sx={{ flex: 1 }} />
            {eventsExpanded ? (
              <KeyboardArrowUp fontSize="small" sx={{ color: 'warning.main' }} />
            ) : (
              <KeyboardArrowDown fontSize="small" sx={{ color: 'warning.main' }} />
            )}
          </Box>
          {/* 折叠详情 */}
          <Collapse in={eventsExpanded}>
            {currentEvents.map((evt, i) => (
              <Box key={i} sx={{ mt: 0.75, pl: 0.5, borderLeft: 2, borderColor: evt.impact === 'positive' ? '#4caf50' : evt.impact === 'negative' ? '#f44336' : '#ff9800' }}>
                <Typography variant="caption" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
                  {evt.title}
                </Typography>
                <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 0.25, lineHeight: 1.3 }}>
                  {evt.description.length > 80 ? evt.description.substring(0, 80) + '...' : evt.description}
                </Typography>
                <Box display="flex" gap={0.5} mt={0.25}>
                  <Chip
                    label={evt.impact === 'positive' ? '利好' : evt.impact === 'negative' ? '利空' : '中性'}
                    size="small"
                    color={evt.impact === 'positive' ? 'success' : evt.impact === 'negative' ? 'error' : 'default'}
                    sx={{ height: 16, fontSize: '0.6rem' }}
                  />
                  {evt.price_reaction && (
                    <Chip
                      label={`反应: ${evt.price_reaction}`}
                      size="small"
                      variant="outlined"
                      sx={{ height: 16, fontSize: '0.6rem', color: 'text.secondary' }}
                    />
                  )}
                </Box>
              </Box>
            ))}
          </Collapse>
          {!eventsExpanded && currentEvents.length === 1 && (
            <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.25, display: 'block' }}>
              {currentEvents[0].title.length > 50 ? currentEvents[0].title.substring(0, 50) + '...' : currentEvents[0].title}
            </Typography>
          )}
        </Box>
      )}

      {/* 操作按钮: 买 / 卖 / 观望 */}
      <Box display="flex" gap={1}>
        <Button
          variant="contained"
          color="success"
          fullWidth
          onClick={() => handleDecision('buy')}
          disabled={!hasValidData || previewBuyQty <= 0}
          startIcon={<TrendingUp />}
        >
          买
        </Button>
        <Button
          variant="contained"
          color="error"
          fullWidth
          onClick={() => handleDecision('sell')}
          disabled={!hasValidData || !hasPosition || previewSellQty <= 0}
          startIcon={<TrendingDown />}
        >
          卖
        </Button>
        <Button
          variant="outlined"
          color="info"
          fullWidth
          onClick={handleHold}
          disabled={!hasValidData}
          startIcon={<RemoveCircleOutline />}
        >
          观望
        </Button>
      </Box>

    </Paper>
  );
};
