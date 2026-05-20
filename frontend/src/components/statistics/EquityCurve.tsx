import React, { useEffect, useRef } from 'react';
import { Card, CardContent } from '@mui/material';
import * as echarts from 'echarts';

interface EquityPoint {
  timestamp: string;
  equity: number;
}

interface EquityCurveProps {
  data: EquityPoint[];
  title?: string;
  height?: number;
}

export const EquityCurve: React.FC<EquityCurveProps> = ({
  data,
  title = '收益曲线',
  height = 300,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    // 初始化图表
    chartInstance.current = echarts.init(chartRef.current);

    // 准备数据
    const timestamps = data.map(d => d.timestamp);
    const equity = data.map(d => d.equity);
    const maxEquity = Math.max(...equity);
    const minEquity = Math.min(...equity);

    // 配置项
    const option: echarts.EChartsOption = {
      title: {
        text: title,
        left: 'center',
        textStyle: {
          color: '#d1d5db',
          fontSize: 14,
        },
      },
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const point = params[0];
          return `时间: ${point.axisValue}<br/>权益: ${point.value.toFixed(2)}`;
        },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: timestamps,
        axisLabel: {
          color: '#9ca3af',
          formatter: (value: string) => {
            const date = new Date(value);
            return `${date.getMonth() + 1}/${date.getDate()}`;
          },
        },
        axisLine: {
          lineStyle: { color: '#374151' },
        },
      },
      yAxis: {
        type: 'value',
        min: Math.floor(minEquity * 0.98),
        max: Math.ceil(maxEquity * 1.02),
        axisLabel: {
          color: '#9ca3af',
        },
        splitLine: {
          lineStyle: { color: '#1f2937' },
        },
      },
      series: [
        {
          data: equity,
          type: 'line',
          smooth: true,
          lineStyle: {
            color: '#6366f1',
            width: 2,
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(99, 102, 241, 0.3)' },
                { offset: 1, color: 'rgba(99, 102, 241, 0.05)' },
              ],
            },
          },
          itemStyle: {
            color: '#6366f1',
          },
        },
      ],
    };

    chartInstance.current.setOption(option);

    // 响应窗口变化
    const handleResize = () => {
      chartInstance.current?.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chartInstance.current?.dispose();
    };
  }, [data, title, height]);

  return (
    <Card sx={{ bgcolor: 'background.paper' }}>
      <CardContent>
        <div ref={chartRef} style={{ width: '100%', height: `${height}px` }} />
      </CardContent>
    </Card>
  );
};
