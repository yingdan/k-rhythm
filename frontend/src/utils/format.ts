// 格式化工具函数

/**
 * 格式化价格
 * @param price 价格
 * @param decimals 小数位数，默认2位
 */
export const formatPrice = (price: number, decimals: number = 2): string => {
  return price.toFixed(decimals);
};

/**
 * 格式化数量
 * @param volume 数量
 */
export const formatVolume = (volume: number): string => {
  if (volume >= 100000000) {
    return (volume / 100000000).toFixed(2) + '亿';
  }
  if (volume >= 10000) {
    return (volume / 10000).toFixed(2) + '万';
  }
  return volume.toString();
};

/**
 * 格式化百分比
 * @param value 小数值
 * @param decimals 小数位数，默认2位
 */
export const formatPercent = (value: number, decimals: number = 2): string => {
  return (value * 100).toFixed(decimals) + '%';
};

/**
 * 格式化日期
 * @param dateString 日期字符串
 * @param format 格式类型
 */
export const formatDate = (
  dateString: string,
  format: 'short' | 'medium' | 'long' = 'medium'
): string => {
  const date = new Date(dateString);

  switch (format) {
    case 'short':
      return `${date.getMonth() + 1}/${date.getDate()}`;
    case 'long':
      return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    case 'medium':
    default:
      return date.toLocaleDateString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
      });
  }
};

/**
 * 格式化时间
 * @param dateString 日期字符串
 */
export const formatTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * 格式化盈亏金额
 * @param pnl 盈亏金额
 * @param prefix 前缀，默认¥
 */
export const formatPnl = (pnl: number, prefix: string = '¥'): string => {
  const sign = pnl >= 0 ? '+' : '';
  return `${prefix}${sign}${pnl.toFixed(2)}`;
};

/**
 * 格式化大数字（如市值）
 * @param num 数字
 */
export const formatLargeNumber = (num: number): string => {
  if (num >= 100000000) {
    return (num / 100000000).toFixed(2) + '亿';
  }
  if (num >= 10000) {
    return (num / 10000).toFixed(2) + '万';
  }
  return num.toFixed(2);
};

/**
 * 颜色类名映射（根据涨跌）
 * @param value 当前值
 * @param compareValue 比较值
 */
export const getChangeColor = (
  value: number,
  compareValue: number
): 'success.main' | 'error.main' | 'text.primary' => {
  if (value > compareValue) return 'success.main';
  if (value < compareValue) return 'error.main';
  return 'text.primary';
};
