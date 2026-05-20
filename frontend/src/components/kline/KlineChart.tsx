import { useEffect, useRef, forwardRef, useImperativeHandle, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData, HistogramData, LineData, Time, UTCTimestamp } from 'lightweight-charts';
import { Box, Typography } from '@mui/material';
import type { UsEvent } from '../../types/api';

// 时间格式化函数 - 只显示月份
const formatTime = (time: Time) => {
  const date = new Date((time as UTCTimestamp) * 1000);
  const month = date.getMonth() + 1;
  return `${month}月`;
};

// 计算 EMA
const calculateEMA = (data: number[], period: number): number[] => {
  const k = 2 / (period + 1);
  const ema: number[] = [];
  
  // 第一个 EMA 值就是第一个数据点
  if (data.length > 0) {
    ema.push(data[0]);
  }
  
  for (let i = 1; i < data.length; i++) {
    ema.push(data[i] * k + ema[i - 1] * (1 - k));
  }
  
  return ema;
};

// 计算 MACD
interface MACDResult {
  dif: number[];
  dea: number[];
  macd: number[];
}

const calculateMACD = (closes: number[]): MACDResult => {
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  
  const dif = ema12.map((v, i) => v - ema26[i]);
  const dea = calculateEMA(dif, 9);
  const macd = dif.map((v, i) => (v - dea[i]) * 2);
  
  return { dif, dea, macd };
};

export interface KlineBar {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TradeAnnotation {
  index: number;
  timestamp: string;
  type: 'buy' | 'sell';
  price: number;
  tradeId?: string;
  aiAnalysis?: string;
}

export interface KlineChartProps {
  bars: KlineBar[];
  height?: number;
  showVolume?: boolean;
  showMACD?: boolean;
  annotations?: TradeAnnotation[];
  /** 用于 A股红涨绿跌 / 美股绿涨红跌 */
  symbolCode?: string;
  /** 美股事件标记 */
  events?: UsEvent[];
}

/** 沪深为 A 股配色，其余按美股（国际）配色 */
export function isAStockSymbol(code: string | undefined): boolean {
  if (!code) return false;
  return code.includes('.SH') || code.includes('.SZ');
}

/** A股：红涨绿跌；美股：绿涨红跌 */
export function getCandlePalette(isAStock: boolean) {
  if (isAStock) {
    return {
      up: '#ef5350',
      down: '#26a69a',
      upWick: '#ef5350',
      downWick: '#26a69a',
      volUp: 'rgba(239, 83, 80, 0.52)',
      volDown: 'rgba(38, 166, 154, 0.5)',
      macdPos: 'rgba(239, 83, 80, 0.82)',
      macdNeg: 'rgba(38, 166, 154, 0.82)',
    };
  }
  return {
    up: '#26a69a',
    down: '#ef5350',
    upWick: '#26a69a',
    downWick: '#ef5350',
    volUp: 'rgba(38, 166, 154, 0.5)',
    volDown: 'rgba(239, 83, 80, 0.52)',
    macdPos: 'rgba(38, 166, 154, 0.82)',
    macdNeg: 'rgba(239, 83, 80, 0.82)',
  };
}

/** K 线画布上的 AI 复盘标签（竖排 vertical-lr） */
interface ChartAiLabel {
  id: string;
  x: number;
  top: number;
  text: string;
  type: 'buy' | 'sell';
  anchorX: number;
  anchorY: number;
  boxH: number;
}

type Bounds = { left: number; right: number; top: number; bottom: number };

const CHARS_PER_VERTICAL_COLUMN = 14;
const VERTICAL_LINE_PX = 14;

function verticalLrApproxBox(text: string, containerHeight: number) {
  const columns = Math.max(1, Math.ceil(text.length / CHARS_PER_VERTICAL_COLUMN));
  const approxH = Math.min(
    Math.floor(containerHeight * 0.55),
    CHARS_PER_VERTICAL_COLUMN * VERTICAL_LINE_PX + 18,
  );
  const approxW = Math.min(200, 24 + columns * 30);
  return { approxH, approxW };
}

function labelScreenBounds(x: number, top: number, approxW: number, approxH: number) {
  return {
    left: x - approxW / 2,
    right: x + approxW / 2,
    top,
    bottom: top + approxH,
  };
}

function boundsOverlap(a: { left: number; right: number; top: number; bottom: number }, b: {
  left: number;
  right: number;
  top: number;
  bottom: number;
}) {
  return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
}

/** 卖单：竖排在成交价上方，尽量不压蜡烛 */
function layoutSellVerticalLr(
  items: Array<{ id: string; x: number; priceY: number; text: string }>,
  containerHeight: number,
): { labels: Array<{ id: string; x: number; top: number; text: string; anchorX: number; anchorY: number; boxH: number }>; rects: Bounds[] } {
  if (items.length === 0) return { labels: [], rects: [] };

  const topPad = 4;
  const anchorAbove = 24;

  const drafts = items.map((item) => {
    const { approxH, approxW } = verticalLrApproxBox(item.text, containerHeight);
    const maxTop = item.priceY - approxH - 10;
    let top = item.priceY - approxH - anchorAbove;
    top = Math.min(top, maxTop);
    top = Math.max(topPad, top);
    return { ...item, approxH, approxW, top, x: item.x, anchorX: item.x, anchorY: item.priceY };
  });

  drafts.sort((a, b) => a.priceY - b.priceY || a.x - b.x);
  const placed: Array<(typeof drafts)[number]> = [];

  for (const d of drafts) {
    let { top, x } = d;
    for (let iter = 0; iter < 56; iter += 1) {
      const rect = labelScreenBounds(x, top, d.approxW, d.approxH);
      const conflict = placed.some((p) =>
        boundsOverlap(rect, labelScreenBounds(p.x, p.top, p.approxW, p.approxH)),
      );
      if (!conflict) break;
      top -= 12;
      top = Math.max(topPad, Math.min(top, d.priceY - d.approxH - 8));
      if (iter % 5 === 4) {
        x += iter % 10 === 4 ? 28 : -28;
      }
    }
    top = Math.max(topPad, Math.min(top, d.priceY - d.approxH - 8));
    placed.push({ ...d, top, x });
  }

  const labels = placed.map(({ id, x, top, text, anchorX, anchorY, approxH }) => ({
    id,
    x,
    top,
    text,
    anchorX,
    anchorY,
    boxH: approxH,
  }));
  const rects = placed.map((d) => labelScreenBounds(d.x, d.top, d.approxW, d.approxH));
  return { labels, rects };
}

/** 买单：锚在成交价下方；可盖住成交量 / MACD；避让 avoidRects（如卖单标签） */
function layoutBuyVerticalLr(
  items: Array<{ id: string; x: number; priceY: number; text: string }>,
  containerHeight: number,
  avoidRects: Bounds[],
): { labels: Array<{ id: string; x: number; top: number; text: string; anchorX: number; anchorY: number; boxH: number }>; rects: Bounds[] } {
  if (items.length === 0) return { labels: [], rects: [] };

  const topPad = 4;
  const bottomPad = 14;
  /** 与 K 线实体/标记拉开距离，减少遮挡主图 */
  const anchorBelowPrice = 26;

  const drafts = items.map((item) => {
    const { approxH, approxW } = verticalLrApproxBox(item.text, containerHeight);
    let top = item.priceY + anchorBelowPrice;
    top = Math.min(top, containerHeight - bottomPad - approxH);
    top = Math.max(top, item.priceY + 12);
    return { ...item, approxH, approxW, top, x: item.x, anchorX: item.x, anchorY: item.priceY };
  });

  drafts.sort((a, b) => b.priceY - a.priceY || a.x - b.x);
  const placed: Array<(typeof drafts)[number]> = [];

  for (const d of drafts) {
    let { top, x } = d;
    for (let iter = 0; iter < 56; iter += 1) {
      const rect = labelScreenBounds(x, top, d.approxW, d.approxH);
      const conflict =
        placed.some((p) =>
          boundsOverlap(rect, labelScreenBounds(p.x, p.top, p.approxW, p.approxH)),
        ) || avoidRects.some((r) => boundsOverlap(rect, r));
      if (!conflict) break;
      top += 12;
      top = Math.min(top, containerHeight - bottomPad - d.approxH);
      if (iter % 5 === 4) {
        x += iter % 10 === 4 ? 28 : -28;
      }
    }
    top = Math.max(topPad, top, d.priceY + 10);
    placed.push({ ...d, top, x });
  }

  const labels = placed.map(({ id, x, top, text, anchorX, anchorY, approxH }) => ({
    id,
    x,
    top,
    text,
    anchorX,
    anchorY,
    boxH: approxH,
  }));
  const rects = placed.map((d) => labelScreenBounds(d.x, d.top, d.approxW, d.approxH));
  return { labels, rects };
}

const EVENT_MARKER_COLORS: Record<string, string> = {
  positive: '#4caf50',
  negative: '#f44336',
  neutral: '#ff9800',
};

const EVENT_MARKER_SHAPES: Record<string, 'circle' | 'arrowUp' | 'arrowDown' | 'square'> = {
  earnings: 'circle',
  fed: 'arrowDown',
  economic: 'circle',
  split: 'arrowUp',
  dividend: 'arrowUp',
  corporate: 'square',
  macro: 'arrowDown',
};

export const KlineChart = forwardRef<any, KlineChartProps>(({
  bars,
  height = 500,
  showVolume = true,
  showMACD = true,
  annotations = [],
  symbolCode = '',
  events = [],
}, ref) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const macdDifSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const macdDeaSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const macdHistogramRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const [aiLabels, setAiLabels] = useState<ChartAiLabel[]>([]);
  const [activeLabelId, setActiveLabelId] = useState<string | null>(null);

  // 暴露 chart 实例给父组件
  useImperativeHandle(ref, () => ({
    getChart: () => chartRef.current,
  }));

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: '#1a1a2e' },
        textColor: '#d1d5db',
      },
      grid: {
        vertLines: { color: '#2d2d44' },
        horzLines: { color: '#2d2d44' },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          width: 1,
          color: '#8585aa',
          style: 2,
        },
        horzLine: {
          width: 1,
          color: '#8585aa',
          style: 2,
        },
      },
      timeScale: {
        borderColor: '#2d2d44',
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (time: Time) => formatTime(time),
      },
      rightPriceScale: {
        borderColor: '#2d2d44',
      },
    });

    const isAsia = isAStockSymbol(symbolCode);
    const pal = getCandlePalette(isAsia);

    // 添加K线系列
    const candleSeries = chart.addCandlestickSeries({
      upColor: pal.up,
      downColor: pal.down,
      borderVisible: false,
      wickUpColor: pal.upWick,
      wickDownColor: pal.downWick,
    });
    candleSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.06, bottom: showVolume || showMACD ? 0.36 : 0.08 },
    });

    // 添加成交量系列
    if (showVolume) {
      const volumeSeries = chart.addHistogramSeries({
        color: pal.up,
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
      });

      // 成交量占中下方区域，给 MACD 留出独立底部空间。
      volumeSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.68, bottom: showMACD ? 0.18 : 0.03 },
      });

      volumeSeriesRef.current = volumeSeries;
    }

    // 添加 MACD 指标
    if (showMACD) {
      // DIF 线
      const difSeries = chart.addLineSeries({
        color: '#2196f3',
        lineWidth: 1,
        priceScaleId: 'macd',
        lastValueVisible: false,
        priceLineVisible: false,
      });

      // DEA 线
      const deaSeries = chart.addLineSeries({
        color: '#ff9800',
        lineWidth: 1,
        priceScaleId: 'macd',
        lastValueVisible: false,
        priceLineVisible: false,
      });

      // MACD 柱状图
      const macdHistogram = chart.addHistogramSeries({
        color: pal.up,
        priceScaleId: 'macd',
        lastValueVisible: false,
        priceLineVisible: false,
      });

      // MACD 固定在最底部区域，避免和成交量柱重叠。
      chart.priceScale('macd').applyOptions({
        scaleMargins: { top: 0.86, bottom: 0.02 },
      });

      macdDifSeriesRef.current = difSeries;
      macdDeaSeriesRef.current = deaSeries;
      macdHistogramRef.current = macdHistogram;
    }

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;

    // 响应式
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [showVolume, showMACD, symbolCode]);

  const updateAnalysisLabels = () => {
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    if (!chart || !candleSeries) return;

    const container = chartContainerRef.current;
    const containerWidth = container?.clientWidth || 0;
    const containerHeight = container?.clientHeight || 0;

    const items: Array<{
      id: string;
      x: number;
      priceY: number;
      type: 'buy' | 'sell';
      text: string;
    }> = [];

    annotations.forEach((ann) => {
      if (!ann.aiAnalysis) return;

      const time = (new Date(ann.timestamp).getTime() / 1000) as Time;
      const x = chart.timeScale().timeToCoordinate(time);
      const priceY = candleSeries.priceToCoordinate(ann.price);
      if (x === null || priceY === null) return;
      if (containerWidth && (Number(x) < -80 || Number(x) > containerWidth + 80)) return;

      items.push({
        id: `${ann.timestamp}-${ann.type}-${ann.price}`,
        x: Number(x),
        priceY: Number(priceY),
        type: ann.type,
        text: ann.aiAnalysis,
      });
    });

    const buyItems = items
      .filter((i) => i.type === 'buy')
      .map(({ id, x, priceY, text }) => ({ id, x, priceY, text }));
    const sellItems = items
      .filter((i) => i.type === 'sell')
      .map(({ id, x, priceY, text }) => ({ id, x, priceY, text }));

    const sellResult = layoutSellVerticalLr(sellItems, containerHeight);
    const buyResult = layoutBuyVerticalLr(buyItems, containerHeight, sellResult.rects);

    setAiLabels([
      ...sellResult.labels.map((l) => ({ ...l, type: 'sell' as const })),
      ...buyResult.labels.map((l) => ({ ...l, type: 'buy' as const })),
    ]);
  };
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const update = () => {
      window.requestAnimationFrame(updateAnalysisLabels);
    };

    chart.timeScale().subscribeVisibleLogicalRangeChange(update);
    window.addEventListener('resize', update);
    update();

    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(update);
      window.removeEventListener('resize', update);
    };
  }, [annotations, bars, showVolume, showMACD, symbolCode]);

  // 更新数据
  useEffect(() => {
    if (!candleSeriesRef.current) return;
    
    // 如果没有数据，只清空图表
    if (!bars || bars.length === 0) {
      try {
        candleSeriesRef.current.setData([]);
        volumeSeriesRef.current?.setData([]);
        macdDifSeriesRef.current?.setData([]);
        macdDeaSeriesRef.current?.setData([]);
        macdHistogramRef.current?.setData([]);
      } catch (e) {
        // 忽略错误
      }
      return;
    }

    // 确保K线数据按时间升序排列（lightweight-charts 要求）
    // 使用秒精度去重，因为 lightweight-charts 以秒为单位存储时间
    const timeSeen = new Set<number>();
    const sortedBars = [...bars]
      .map((bar) => ({
        ...bar,
        _sec: Math.floor(new Date(bar.timestamp).getTime() / 1000),
      }))
      .sort((a, b) => a._sec - b._sec)
      .filter((bar) => {
        if (timeSeen.has(bar._sec)) {
          return false;
        }
        timeSeen.add(bar._sec);
        return true;
      });

    const isAsia = isAStockSymbol(symbolCode);
    const pal = getCandlePalette(isAsia);

    const candleData: CandlestickData<Time>[] = sortedBars.map((bar) => ({
      time: bar._sec as Time,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
    }));

    candleSeriesRef.current.setData(candleData);

    // 更新成交量
    if (volumeSeriesRef.current) {
      const volumeData: HistogramData<Time>[] = sortedBars.map((bar) => ({
        time: bar._sec as Time,
        value: bar.volume,
        color: bar.close >= bar.open ? pal.volUp : pal.volDown,
      }));
      volumeSeriesRef.current.setData(volumeData);
    }

    // 更新 MACD 指标
    if (showMACD && macdDifSeriesRef.current && macdDeaSeriesRef.current && macdHistogramRef.current) {
      const closes = sortedBars.map((b) => b.close);
      const macd = calculateMACD(closes);

      // DIF 和 DEA（使用 _sec 保证与 candleData 时间对齐）
      const difData: LineData<Time>[] = macd.dif.map((v, i) => ({
        time: sortedBars[i]._sec as Time,
        value: v,
      }));

      const deaData: LineData<Time>[] = macd.dea.map((v, i) => ({
        time: sortedBars[i]._sec as Time,
        value: v,
      }));

      // MACD 柱状图
      const macdData: HistogramData<Time>[] = macd.macd.map((v, i) => ({
        time: sortedBars[i]._sec as Time,
        value: v,
        color: v >= 0 ? pal.macdPos : pal.macdNeg,
      }));

      macdDifSeriesRef.current.setData(difData);
      macdDeaSeriesRef.current.setData(deaData);
      macdHistogramRef.current.setData(macdData);
    }

    // 更新买卖点标记
    if (candleSeriesRef.current) {
      const tradeMarkers = annotations.map((ann) => ({
        time: (new Date(ann.timestamp).getTime() / 1000) as Time,
        color: ann.type === 'buy' ? '#4caf50' : '#f44336',
        shape: ann.type === 'buy' ? 'arrowUp' as const : 'arrowDown' as const,
        position: ann.type === 'buy' ? 'belowBar' as const : 'aboveBar' as const,
        text: ann.type === 'buy' ? '买' : '卖',
      }));

      // 事件标记：彩色标记所有历史事件，用形状区分类型
      const eventMarkers = events
        .filter((evt) => {
          const ts = new Date(evt.date + 'T00:00:00').getTime() / 1000;
          return ts > 0;
        })
        .map((evt) => {
          const impactColor = EVENT_MARKER_COLORS[evt.impact] || '#ff9800';
          const shape = EVENT_MARKER_SHAPES[evt.type] || 'circle';
          const shortText = evt.title.length > 15 ? evt.title.substring(0, 15) + '…' : evt.title;
          return {
            time: (new Date(evt.date + 'T00:00:00').getTime() / 1000) as Time,
            color: impactColor,
            shape,
            position: 'aboveBar' as const,
            text: shortText,
            size: 3,
          };
        });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      candleSeriesRef.current.setMarkers([...tradeMarkers, ...eventMarkers] as any);
    }
    window.requestAnimationFrame(updateAnalysisLabels);

    // 滚动到最新K线位置
    if (chartRef.current) {
      chartRef.current.timeScale().scrollToRealTime();
    }
  }, [bars, showMACD, showVolume, annotations, symbolCode, events]);

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        height,
        overflow: 'hidden',
        borderRadius: 1,
        bgcolor: '#1a1a2e',
      }}
    >
      <Box
        ref={chartContainerRef}
        sx={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
        }}
      />
      {(!bars || bars.length === 0) && (
        <Typography
          color="text.secondary"
          sx={{ position: 'absolute', left: 0, right: 0, top: '50%', zIndex: 1, textAlign: 'center', transform: 'translateY(-50%)' }}
        >
          等待K线数据...
        </Typography>
      )}
      {aiLabels.length > 0 && (
        <svg
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: '100%',
            zIndex: 4,
            pointerEvents: 'none',
            overflow: 'visible',
          }}
        >
          {aiLabels.map((lab) => {
            const connectY = lab.type === 'buy' ? lab.top : lab.top + lab.boxH;
            return (
              <line
                key={`conn-${lab.id}`}
                x1={lab.anchorX}
                y1={lab.anchorY}
                x2={lab.x}
                y2={connectY}
                stroke={lab.type === 'buy' ? 'rgba(129,199,132,0.55)' : 'rgba(239,154,154,0.58)'}
                strokeWidth={1.25}
                strokeDasharray="5 4"
              />
            );
          })}
        </svg>
      )}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          zIndex: 5,
          pointerEvents: 'none',
        }}
      >
        {aiLabels.map((label) => (
          <Box
            key={label.id}
            onClick={() => setActiveLabelId(label.id)}
            sx={{
              position: 'absolute',
              left: label.x,
              top: label.top,
              transform: 'translateX(-50%)',
              writingMode: 'vertical-lr',
              textOrientation: 'upright',
              direction: 'ltr',
              display: 'inline-block',
              width: 'max-content',
              maxWidth: 'min(42vw, 200px)',
              color: label.type === 'buy' ? '#a5d6a7' : '#ef9a9a',
              bgcolor:
                activeLabelId === label.id
                  ? 'rgba(17, 24, 39, 0.96)'
                  : label.type === 'buy'
                    ? 'rgba(26, 26, 46, 0.82)'
                    : 'rgba(26, 26, 46, 0.82)',
              border: `1px solid ${
                activeLabelId === label.id
                  ? label.type === 'buy' ? '#a5d6a7' : '#ef9a9a'
                  : label.type === 'buy' ? 'rgba(129, 199, 132, 0.45)' : 'rgba(239, 154, 154, 0.45)'
              }`,
              borderRadius: 0.75,
              px: 0.5,
              py: 0.75,
              fontSize: 12,
              lineHeight: 1.4,
              zIndex: activeLabelId === label.id ? 8 : 3,
              pointerEvents: 'auto',
              cursor: 'pointer',
              whiteSpace: 'normal',
              maxHeight: 'min(48vh, 260px)',
              overflowY: 'auto',
              boxShadow: activeLabelId === label.id ? '0 0 0 2px rgba(255,255,255,0.12), 0 8px 20px rgba(0,0,0,0.35)' : 'none',
            }}
          >
            {label.text}
          </Box>
        ))}
      </Box>
    </Box>
  );
});

KlineChart.displayName = 'KlineChart';
