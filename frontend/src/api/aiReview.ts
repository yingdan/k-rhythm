const DEEPSEEK_API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY || '';
const DEEPSEEK_API_URL = import.meta.env.VITE_DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions';

export interface TradeRecord {
  id: string;
  type: 'buy' | 'sell' | 'long' | 'short';
  entryPrice: number;
  exitPrice?: number;
  quantity: number;
  pnl?: number;
  timestamp: string;
  exitTimestamp?: string;
  bar?: {
    timestamp: string;
    open: number;
    high: number;
    low: number;
    close: number;
  };
  contextBars?: Array<{
    timestamp: string;
    open: number;
    high: number;
    low: number;
    close: number;
  }>;
}

export interface AIAnalysis {
  tradeId: string;
  analysis: string;
}

/**
 * 检查 API Key 是否已配置
 */
export const isAIEnabled = (): boolean => {
  return !!DEEPSEEK_API_KEY;
};

export const aiReviewApi = {
  // 复盘单笔交易
  analyzeTrade: async (trade: TradeRecord, symbolCode: string): Promise<string> => {
    const prompt = `你是专业的K线技术分析师。请分析以下交易决策：

交易品种：${symbolCode}
交易类型：${trade.type === 'buy' ? '买入' : trade.type === 'sell' ? '卖出' : trade.type === 'long' ? '做多' : '做空'}
入场价格：${trade.entryPrice}
出场价格：${trade.exitPrice || '未出场'}
盈亏：${trade.pnl !== undefined ? (trade.pnl >= 0 ? '盈利' : '亏损') + Math.abs(trade.pnl).toFixed(2) + '元' : '未平仓'}

入场K线：${trade.bar ? `开${trade.bar.open} 高${trade.bar.high} 低${trade.bar.low} 收${trade.bar.close}` : '无数据'}

附近K线序列（含量价）：
${trade.contextBars?.map((bar, index) => `K${index + 1} ${bar.timestamp.split('T')[0]} 开${bar.open} 高${bar.high} 低${bar.low} 收${bar.close}`).join('\n') || '无数据'}

请分析这次决策（50字以内），要求：
1. 侧重量价关系和趋势力度，不提具体支撑位/压力位数字
2. 观察K线实体长短、影线形态、连续涨跌力度
3. 如果能归因于量价形态或趋势节奏，给出归因；如果无法归因，给出通用交易建议

格式：直接输出分析内容，不要加标题和标点符号前缀。`;

    try {
      const response = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: '你是一个专业的K线技术分析师。你侧重分析量价关系和趋势力度，观察K线实体长短、影线形态和连续涨跌节奏，不提及具体支撑位/压力位数字。无法归因时给出通用交易建议。分析简洁（50字以内），直接输出，不用标题。',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          max_tokens: 200,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || '分析生成中...';
    } catch (error) {
      console.error('AI analysis error:', error);
      return 'AI分析暂时不可用';
    }
  },

  // 复盘所有交易并生成总体分析
  analyzeAllTrades: async (trades: TradeRecord[], symbolCode: string): Promise<string> => {
    const isAStock = symbolCode.includes('.SH') || symbolCode.includes('.SZ');
    const marketType = isAStock ? 'A股' : '美股';

    const tradesSummary = trades
      .map((t, i) => {
        const typeText = t.type === 'buy' ? '买入' : t.type === 'sell' ? '卖出' : t.type === 'long' ? '做多' : '做空';
        return `第${i + 1}笔：${typeText} @ ${t.entryPrice} → ${t.exitPrice || '未平仓'}，盈亏${t.pnl !== undefined ? (t.pnl >= 0 ? '+' : '') + t.pnl.toFixed(2) : '?'}元`;
      })
      .join('\n');

    const stats = {
      total: trades.length,
      win: trades.filter((t) => t.pnl !== undefined && t.pnl > 0).length,
      lose: trades.filter((t) => t.pnl !== undefined && t.pnl <= 0).length,
      totalPnl: trades.reduce((sum, t) => sum + (t.pnl || 0), 0),
    };

    const prompt = `你是${marketType}交易训练的专业复盘分析师。请对以下训练记录进行整体复盘分析：

交易品种：${symbolCode}
市场类型：${marketType}
交易统计：
- 总交易次数：${stats.total}次
- 盈利次数：${stats.win}次
- 亏损次数：${stats.lose}次
- 总盈亏：${stats.totalPnl >= 0 ? '+' : ''}${stats.totalPnl.toFixed(2)}元
- 胜率：${stats.total > 0 ? ((stats.win / stats.total) * 100).toFixed(1) : 0}%

交易明细：
${tradesSummary}

请进行整体复盘分析（200字以内），要求：
1. 侧重总结量价配合和趋势跟随方面的表现
2. 不要提具体支撑位/压力位/止损位数字
3. 分析交易节奏和仓位管理是否合理
4. 给出可操作的改进建议

格式：直接输出分析内容，用简洁的段落形式。`;

    try {
      const response = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: `你是一个专业的${marketType}交易复盘分析师。你侧重从量价关系、趋势节奏和仓位管理角度总结交易经验。不提及具体价格点位数字，分析简洁（200字以内）、有建设性。`,
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          max_tokens: 500,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || '复盘分析生成中...';
    } catch (error) {
      console.error('AI review error:', error);
      return 'AI复盘暂时不可用，请稍后重试';
    }
  },
};
