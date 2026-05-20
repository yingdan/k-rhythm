import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Box, Grid, Typography, Snackbar, Alert, AlertColor, Button, Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress, Chip, LinearProgress, useMediaQuery, useTheme } from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import { Psychology, Login as LoginIcon } from '@mui/icons-material';
import { KlineChart, KlineBar, TradeAnnotation } from '../components/kline/KlineChart';
import { TradePanel } from '../components/kline/TradePanel';
import { EventPanel } from '../components/kline/EventPanel';
import { useSessionStore } from '../stores/sessionStore';
import { useAuthStore } from '../stores/authStore';
import { sessionsApi } from '../api/sessions';
import { klineApi } from '../api/kline';
import { eventsApi } from '../api/events';
import { aiReviewApi, TradeRecord, isAIEnabled } from '../api/aiReview';
import {
  buildTrainingSnapshot,
  createContextBars,
  loadUserTrainingSnapshot,
  saveGuestTrainingSnapshot,
  saveUserTrainingSnapshot,
} from '../utils/trainingPersistence';

interface TradeHistory extends TradeRecord {
  aiAnalysis?: string;
}

interface TradeStats {
  totalTrades: number;
  winTrades: number;
  loseTrades: number;
  winRate: number;
  totalPnl: number;
}

const getStoredInitialCapital = () => {
  try {
    const stored = sessionStorage.getItem('training_capital');
    if (!stored) return 100000;
    const parsed = JSON.parse(stored);
    return Number(parsed.amount) || 100000;
  } catch {
    return 100000;
  }
};

export const Training: React.FC = () => {
  const { symbolCode } = useParams<{ symbolCode: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const { user } = useAuthStore();
  const {
    sessionId,
    setSession,
    currentIndex,
    nextBar,
    revealedBars,
    events,
    setEvents,
  } = useSessionStore();

  const [allBars, setAllBars] = useState<KlineBar[]>([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as AlertColor });

  // 决策K线数量（用户选择的训练数量）
  const [decisionCount, setDecisionCount] = useState<number>(100);

  // 交易记录
  const [tradeHistory, setTradeHistory] = useState<TradeHistory[]>([]);

  // 资金和持仓（A股 + 美股统一模型：买=累积，卖=减持）
  const [initialCapital] = useState<number>(() => getStoredInitialCapital());
  const [availableCapital, setAvailableCapital] = useState<number>(() => getStoredInitialCapital());
  const [positionShares, setPositionShares] = useState<number>(0);
  const [positionCost, setPositionCost] = useState<number>(0);

  // 图表标注（买卖点）
  const [annotations, setAnnotations] = useState<TradeAnnotation[]>([]);

  // 统计：纯从 tradeHistory 派生，单一数据源，不会对不上
  const tradeStats: TradeStats = useMemo(() => {
    const closedTrades = tradeHistory.filter((t) => t.pnl !== undefined);
    const winTrades = closedTrades.filter((t) => t.pnl! > 0);
    const loseTrades = closedTrades.filter((t) => t.pnl! < 0);
    const settledTrades = winTrades.length + loseTrades.length;
    const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);

    return {
      totalTrades: closedTrades.length,
      winTrades: winTrades.length,
      loseTrades: loseTrades.length,
      winRate: settledTrades > 0 ? (winTrades.length / settledTrades) * 100 : 0,
      totalPnl,
    };
  }, [tradeHistory]);

  // AI 复盘
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // 登录提示弹窗
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);

  // 初始显示的K线数量（用于填满页面左侧，作为历史参考）
  const INITIAL_DISPLAY_COUNT = 200;

  // 已决策的K线数量
  const [decidedCount, setDecidedCount] = useState<number>(0);

  // 初始化标志
  const initRef = useRef(false);
  const hasInitializedRef = useRef(false);

  // 初始化
  useEffect(() => {
    if (initRef.current || hasInitializedRef.current) return;
    initRef.current = true;

    const init = async () => {
      if (!symbolCode) return;

      // 从 sessionStorage 获取K线数量设置
      const stored = sessionStorage.getItem('training_kline_count');
      const klineCount = stored ? parseInt(stored, 10) : 100;
      setDecisionCount(klineCount);

      try {
        const klineRes = await klineApi.getKline(symbolCode);
        const bars = klineRes.data?.bars || [];

        // 对美股加载事件数据
        const isUS = !symbolCode?.includes('.SH') && !symbolCode?.includes('.SZ');
        if (isUS && bars.length > 0) {
          try {
            const startDate = bars[0]?.timestamp?.split('T')[0] || '2020-01-01';
            const endDate = bars[bars.length - 1]?.timestamp?.split('T')[0] || '2025-12-31';
            const eventRes = await eventsApi.getEventsInRange(startDate, endDate, symbolCode);
            if (eventRes?.events) {
              setEvents(eventRes.events);
            }
          } catch (eventErr) {
            console.warn('Event loading failed (non-critical):', eventErr);
          }
        }

        // 确保数据按时间升序排列，并去除重复时间戳
        const sortedBars = [...bars]
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
          .filter((bar, index, self) => 
            index === 0 || bar.timestamp !== self[index - 1].timestamp
          );
        
        // 先生成模拟数据作为后备
        let dataToUse = sortedBars;
        if (!dataToUse || dataToUse.length < INITIAL_DISPLAY_COUNT) {
          console.warn('K线数据不足，使用模拟数据');
          dataToUse = generateMockBars(symbolCode, INITIAL_DISPLAY_COUNT + klineCount);
        }
        
        // 立即设置K线数据
        setAllBars(dataToUse);

        const startDate = dataToUse[0]?.timestamp?.split('T')[0] || '2020-01-01';
        const endDate = dataToUse[dataToUse.length - 1]?.timestamp?.split('T')[0] || '2024-12-31';

        // 计算历史K线和决策K线的分界点
        // 决策K线 = 最后 klineCount 根K线
        // 历史K线 = 决策K线之前的K线，最多显示 INITIAL_DISPLAY_COUNT 根
        const decisionStart = Math.max(0, dataToUse.length - klineCount);
        const historyStart = Math.max(0, decisionStart - INITIAL_DISPLAY_COUNT);
        const historyBars = dataToUse.slice(historyStart, decisionStart);
        
        console.log('K线初始化:', {
          totalBars: dataToUse.length,
          historyBars: historyBars.length,
          decisionStart,
          klineCount
        });

        try {
          const sessionRes = await sessionsApi.create({
            symbol_id: 1,
            period: 'daily',
            mode: 'sequential',
            start_date: startDate,
            end_date: endDate,
          });
          // setSession 会同时设置 currentIndex 为 historyBars.length
          setSession(sessionRes.data.id, 1, symbolCode, historyBars);
        } catch (err) {
          setSession('mock-session-id', 1, symbolCode, historyBars);
        }

        if (isAuthenticated && user?.id) {
          const snapshot = loadUserTrainingSnapshot(user.id, symbolCode);
          if (snapshot) {
            setTradeHistory(snapshot.tradeHistory);
            setAnnotations(snapshot.annotations);
          }
        }
        
        // 标记初始化完成
        setTimeout(() => {
          hasInitializedRef.current = true;
        }, 0);
      } catch (error) {
        console.warn('实时数据加载失败，使用本地数据:', error);
        // 后端会自动生成高质量模拟数据，前端直接使用
        const mockBars = generateMockBars(symbolCode, INITIAL_DISPLAY_COUNT + klineCount);
        setAllBars(mockBars);

        const uniqueMockBars = mockBars.filter((bar, index, self) =>
          index === 0 || bar.timestamp !== self[index - 1].timestamp
        );

        const historyBars = uniqueMockBars.slice(0, INITIAL_DISPLAY_COUNT);
        setSession('mock-session-id', 1, symbolCode, historyBars);

        setTimeout(() => {
          hasInitializedRef.current = true;
        }, 0);
      }
    };

    init();
  }, [symbolCode, isAuthenticated, user?.id]);

  useEffect(() => {
    if (!symbolCode || tradeHistory.length === 0) return;

    const snapshot = buildTrainingSnapshot(symbolCode, tradeHistory, annotations);
    if (isAuthenticated && user?.id) {
      saveUserTrainingSnapshot(user.id, snapshot);
    } else {
      saveGuestTrainingSnapshot(snapshot);
    }
  }, [symbolCode, tradeHistory, annotations, isAuthenticated, user?.id]);

  // 生成模拟数据
  const generateMockBars = (code: string, count: number = 200) => {
    const bars: KlineBar[] = [];
    let price = code.includes('600519') ? 1800 : 100;
    const now = new Date();

    for (let i = count; i >= 0; i--) {
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

  // 下一根K线（用户决策后调用）
  const handleNextBar = useCallback(async (): Promise<boolean> => {
    console.log('handleNextBar called, currentIndex:', currentIndex, 'decidedCount:', decidedCount);
    
    // 边界检查 - 首先检查数据
    if (!allBars || allBars.length === 0) {
      console.warn('handleNextBar: 没有K线数据');
      setSnackbar({ open: true, message: 'K线数据加载中，请稍后...', severity: 'warning' });
      return false;
    }

    // 检查是否已达到决策数量
    if (decidedCount >= decisionCount) {
      setSnackbar({ open: true, message: `已决策 ${decisionCount} 根K线，训练完成！`, severity: 'success' });
      return false;
    }

    // 检查是否还有K线
    if (currentIndex >= allBars.length) {
      console.warn('handleNextBar: 没有更多K线了');
      setSnackbar({ open: true, message: '没有更多K线数据了', severity: 'warning' });
      return false;
    }
    
    // 获取当前决策K线（currentIndex 指向下一根要添加的K线）
    const currentDecisionBar = allBars[currentIndex];
    if (!currentDecisionBar) {
      console.warn('handleNextBar: 无法获取决策K线');
      return false;
    }

    console.log('Adding bar:', currentDecisionBar.timestamp, 'as decision #', decidedCount + 1, 'from index', currentIndex);
    
    // 增加决策计数
    const newDecidedCount = decidedCount + 1;

    // 将当前决策K线加入 revealedBars（变成历史K线）
    // nextBar 会同时增加 currentIndex
    nextBar(currentDecisionBar);
    console.log('nextBar called, new currentIndex will be:', currentIndex + 1);

    // API 同步（可选，不影响本地逻辑）
    try {
      await sessionsApi.nextBar(sessionId || 'mock-session-id');
    } catch (error) {
      // API失败不影响本地
    }

    setDecidedCount(newDecidedCount);

    // 检查是否达到决策数量
    if (newDecidedCount >= decisionCount) {
      setSnackbar({ open: true, message: `已决策 ${decisionCount} 根K线，训练完成！`, severity: 'success' });
    }
    return true;
  }, [sessionId, currentIndex, allBars, nextBar, decidedCount, decisionCount]);

  // 开仓/卖 — A股和美股统一模型：买=累积持仓，卖=减持持仓（按均价计算盈亏）
  const handleOpenPosition = async (direction: 'buy' | 'sell' | 'long' | 'short', quantity: number): Promise<boolean> => {
    // 统一方向：long → buy, short → sell
    const normalizedDir = direction === 'long' ? 'buy' : direction === 'short' ? 'sell' : direction;
    console.log('handleOpenPosition called:', { direction: normalizedDir, quantity, currentIndex });

    const entryPrice = allBars[currentIndex]?.close || 0;
    const currentBar = allBars[currentIndex];

    if (decidedCount >= decisionCount || currentIndex >= allBars.length) {
      setSnackbar({ open: true, message: '训练已完成或没有更多K线', severity: 'warning' });
      return false;
    }

    if (!currentBar || entryPrice <= 0) {
      setSnackbar({ open: true, message: '当前K线数据不可用', severity: 'warning' });
      return false;
    }

    const tradeAmount = entryPrice * quantity;

    if (normalizedDir === 'buy') {
      // 买：扣减可用资金，增加持仓
      if (tradeAmount > availableCapital) {
        setSnackbar({
          open: true,
          message: `可用余额不足 (需要 ${tradeAmount.toFixed(2)}，可用 ${availableCapital.toFixed(2)})`,
          severity: 'error',
        });
        return false;
      }

      const tradeId = `trade-${Date.now()}`;
      const newAnnotation: TradeAnnotation = {
        index: currentIndex,
        timestamp: currentBar.timestamp,
        type: 'buy',
        price: entryPrice,
        tradeId,
      };
      const newTrade: TradeHistory = {
        id: tradeId,
        type: 'buy',
        entryPrice,
        quantity,
        timestamp: new Date().toISOString(),
        bar: currentBar,
        contextBars: createContextBars(allBars, currentIndex),
      };

      setAnnotations((prev) => [...prev, newAnnotation]);
      setAvailableCapital((prev) => prev - tradeAmount);
      setPositionShares((prev) => prev + quantity);
      setPositionCost((prev) => prev + tradeAmount);
      setTradeHistory((prev) => [...prev, newTrade]);
      setSnackbar({
        open: true,
        message: `买入 (${quantity}股 @ ${entryPrice.toFixed(2)})`,
        severity: 'success',
      });
      return true;
    }

    // 卖：按持仓均价计算盈亏，释放资金
    if (quantity > positionShares) {
      setSnackbar({
        open: true,
        message: `持仓不足，当前仅 ${positionShares} 股`,
        severity: 'error',
      });
      return false;
    }

    const averageCost = positionShares > 0 ? positionCost / positionShares : 0;
    const sellCost = averageCost * quantity;
    const realizedPnl = tradeAmount - sellCost;

    const tradeId = `trade-${Date.now()}`;
    const newAnnotation: TradeAnnotation = {
      index: currentIndex,
      timestamp: currentBar.timestamp,
      type: 'sell',
      price: entryPrice,
      tradeId,
    };
    const newTrade: TradeHistory = {
      id: tradeId,
      type: 'sell',
      entryPrice,
      quantity,
      pnl: realizedPnl,
      timestamp: new Date().toISOString(),
      bar: currentBar,
      contextBars: createContextBars(allBars, currentIndex),
    };

    setAnnotations((prev) => [...prev, newAnnotation]);
    setAvailableCapital((prev) => prev + tradeAmount);
    setPositionShares((prev) => prev - quantity);
    setPositionCost((prev) => Math.max(0, prev - sellCost));
    setTradeHistory((prev) => [...prev, newTrade]);
    setSnackbar({
      open: true,
      message: `卖出 (${quantity}股 @ ${entryPrice.toFixed(2)})，${realizedPnl >= 0 ? '盈利' : '亏损'} ${Math.abs(realizedPnl).toFixed(2)}`,
      severity: realizedPnl >= 0 ? 'success' : 'error',
    });
    return true;
  };

  const handleHoldDecision = async (): Promise<boolean> => {
    setSnackbar({
      open: true,
      message: '观望决策已记录',
      severity: 'info',
    });
    return true;
  };


  // AI 复盘
  const handleAIReview = async () => {
    // 检查 AI 功能是否可用
    if (!isAIEnabled()) {
      setSnackbar({ open: true, message: 'AI 功能未配置，请联系管理员', severity: 'warning' });
      return;
    }

    // 检查是否已登录
    if (!isAuthenticated) {
      if (symbolCode && tradeHistory.length > 0) {
        saveGuestTrainingSnapshot(buildTrainingSnapshot(symbolCode, tradeHistory, annotations));
      }
      setLoginDialogOpen(true);
      return;
    }

    setReviewDialogOpen(true);
    setIsAnalyzing(true);
    setAiAnalysis('');

    try {
      const analyzableTrades = tradeHistory.filter((trade) =>
        ['buy', 'sell', 'long', 'short'].includes(trade.type)
      );
      const tradeAnalyses = await Promise.all(
        analyzableTrades.map(async (trade) => ({
          id: trade.id,
          analysis: await aiReviewApi.analyzeTrade(trade, symbolCode || ''),
        }))
      );
      const analysisById = new Map(tradeAnalyses.map((item) => [item.id, item.analysis]));
      const updatedTrades = tradeHistory.map((trade) => ({
        ...trade,
        aiAnalysis: analysisById.get(trade.id) || trade.aiAnalysis,
      }));
      const updatedAnnotations = annotations.map((annotation) => ({
        ...annotation,
        aiAnalysis: annotation.tradeId ? analysisById.get(annotation.tradeId) || annotation.aiAnalysis : annotation.aiAnalysis,
      }));
      setTradeHistory(updatedTrades);
      setAnnotations(updatedAnnotations);

      const overall = await aiReviewApi.analyzeAllTrades(updatedTrades, symbolCode || '');
      setAiAnalysis(overall);

      if (symbolCode && user?.id) {
        saveUserTrainingSnapshot(user.id, buildTrainingSnapshot(symbolCode, updatedTrades, updatedAnnotations));
      }
    } catch (error) {
      setAiAnalysis('AI复盘分析失败，请稍后重试');
    } finally {
      setIsAnalyzing(false);
    }
  };


  const isAStock = symbolCode?.includes('.SH') || symbolCode?.includes('.SZ');
  const currentDecisionBar = allBars[currentIndex];
  const theme = useTheme();
  const isMobile = !useMediaQuery(theme.breakpoints.up('md'));

  const chartHeight = isMobile ? 320 : 500;

  return (
    <Box sx={{ p: isMobile ? 1 : 2, height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* 标题栏 + 进度 */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
        <Typography variant={isMobile ? 'subtitle1' : 'h5'} noWrap>
          训练中 - {symbolCode}
        </Typography>
        <Button
          variant="contained"
          color="primary"
          size={isMobile ? 'small' : 'medium'}
          startIcon={<Psychology />}
          onClick={handleAIReview}
          disabled={tradeHistory.length === 0}
        >
          AI 复盘
        </Button>
      </Box>

      {/* 进度条 */}
      <Box sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', minWidth: 75 }}>
          {decidedCount}/{decisionCount}根
        </Typography>
        <LinearProgress
          variant="determinate"
          value={Math.min((decidedCount / Math.max(decisionCount, 1)) * 100, 100)}
          sx={{ flex: 1, height: 3, borderRadius: 1.5 }}
        />
      </Box>

      <Grid container spacing={isMobile ? 1 : 2} sx={{ flex: 1, overflow: isMobile ? 'auto' : 'hidden' }}>
        {/* K线图 */}
        <Grid item xs={12} md={isMobile ? 12 : 8}>
          <Box sx={{ height: chartHeight, minHeight: 280 }}>
            <KlineChart
              bars={revealedBars}
              height={chartHeight}
              showVolume={!isMobile}
              showMACD={!isMobile}
              annotations={annotations}
              symbolCode={symbolCode ?? ''}
              events={events}
            />
          </Box>
        </Grid>

        {/* 交易面板 + 事件 */}
        <Grid item xs={12} md={isMobile ? 12 : 4}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <TradePanel
              onOpenPosition={handleOpenPosition}
              onNextBar={handleNextBar}
              onHoldDecision={handleHoldDecision}
              currentPrice={currentDecisionBar?.close}
              decisionBar={currentDecisionBar}
              symbolCode={symbolCode}
              initialCapital={initialCapital}
              availableCapital={availableCapital}
              positionShares={positionShares}
              positionCost={positionCost}
              events={events}
              currentBarDate={currentDecisionBar?.timestamp}
            />
            {!isAStock && events.length > 0 && (
              <EventPanel
                events={events}
                currentBarDate={currentDecisionBar?.timestamp}
                height={isMobile ? 180 : 220}
              />
            )}
          </Box>
        </Grid>
      </Grid>

      {/* 提示 */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* AI 复盘弹窗 */}
      <Dialog
        open={reviewDialogOpen}
        onClose={() => setReviewDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <Psychology color="primary" />
            AI 交易复盘分析
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {isAnalyzing ? (
            <Box display="flex" justifyContent="center" alignItems="center" py={4}>
              <CircularProgress />
              <Typography sx={{ ml: 2 }}>AI 正在分析交易记录...</Typography>
            </Box>
          ) : (
            <Box>
              {/* 交易统计概览 */}
              <Box sx={{ mb: 3, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                <Typography variant="subtitle2" gutterBottom>交易统计</Typography>
                <Box display="flex" gap={2} flexWrap="wrap">
                  <Chip label={`总交易: ${tradeStats.totalTrades}次`} size="small" />
                  <Chip label={`盈利: ${tradeStats.winTrades}次`} size="small" color="success" />
                  <Chip label={`亏损: ${tradeStats.loseTrades}次`} size="small" color="error" />
                  <Chip label={`胜率: ${tradeStats.winRate.toFixed(1)}%`} size="small" color="primary" />
                  <Chip 
                    label={`总盈亏: ${tradeStats.totalPnl >= 0 ? '+' : ''}${tradeStats.totalPnl.toFixed(2)}元`} 
                    size="small" 
                    color={tradeStats.totalPnl >= 0 ? 'success' : 'error'}
                  />
                </Box>
              </Box>

              {/* 交易明细 */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>交易明细</Typography>
                {tradeHistory.length > 0 ? (
                  tradeHistory.map((trade, _index) => (
                    <Box key={trade.id} sx={{ mb: 1, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Box>
                          <Typography variant="body2">
                            <Chip 
                              size="small" 
                              label={
                                trade.type === 'buy' ? '买入' : 
                                trade.type === 'sell' ? '卖出' : 
                                trade.type === 'long' ? '做多' : '做空'
                              } 
                              color={trade.type === 'buy' || trade.type === 'long' ? 'success' : 'error'}
                              sx={{ mr: 1 }}
                            />
                            {trade.entryPrice.toFixed(2)} → {trade.exitPrice?.toFixed(2) || '持仓中'}
                          </Typography>
                        </Box>
                        <Typography 
                          variant="body2" 
                          color={trade.pnl !== undefined && trade.pnl >= 0 ? 'success.main' : 'error.main'}
                        >
                          {trade.pnl !== undefined ? (trade.pnl >= 0 ? '+' : '') + trade.pnl.toFixed(2) + '元' : '进行中'}
                        </Typography>
                      </Box>
                    </Box>
                  ))
                ) : (
                  <Typography variant="body2" color="text.secondary">暂无交易记录</Typography>
                )}
              </Box>

              {/* AI 分析结果 */}
              <Box>
                <Typography variant="subtitle2" gutterBottom>AI 复盘分析</Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
                  {aiAnalysis}
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReviewDialogOpen(false)}>关闭</Button>
        </DialogActions>
      </Dialog>

      {/* 登录提示弹窗 */}
      <Dialog
        open={loginDialogOpen}
        onClose={() => setLoginDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <LoginIcon color="primary" />
            需要登录
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            AI 复盘功能需要登录后才能使用
          </Typography>
          <Typography variant="body2" color="text.secondary">
            登录后可享受完整的 AI 智能分析服务
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLoginDialogOpen(false)}>取消</Button>
          <Button
            variant="contained"
            onClick={() => {
              setLoginDialogOpen(false);
              navigate('/login');
            }}
          >
            去登录
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
