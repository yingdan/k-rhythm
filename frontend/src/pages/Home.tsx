import { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  ToggleButton,
  ToggleButtonGroup,
  TextField,
  Autocomplete,
  Grid,
  Chip,
  Slider,
} from '@mui/material';
import { PlayArrow, Casino } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const A_STOCKS = [
  { code: '600000.SH', name: '浦发银行', price: 8.5 },
  { code: '000001.SZ', name: '平安银行', price: 12.3 },
  { code: '600519.SH', name: '贵州茅台', price: 1680 },
  { code: '000858.SZ', name: '五粮液', price: 145 },
  { code: '601318.SH', name: '中国平安', price: 45 },
  { code: '000333.SZ', name: '美的集团', price: 62 },
  { code: '600036.SH', name: '招商银行', price: 35 },
  { code: '601888.SH', name: '中国中免', price: 72 },
  { code: '002594.SZ', name: '比亚迪', price: 265 },
  { code: '600276.SH', name: '恒瑞医药', price: 48 },
];

const US_STOCKS = [
  // Technology
  { code: 'AAPL', name: 'Apple Inc.', price: 195, sector: 'Technology' },
  { code: 'MSFT', name: 'Microsoft Corp.', price: 420, sector: 'Technology' },
  { code: 'GOOGL', name: 'Alphabet Inc.', price: 185, sector: 'Technology' },
  { code: 'AMZN', name: 'Amazon.com Inc.', price: 205, sector: 'Technology' },
  { code: 'NVDA', name: 'NVIDIA Corp.', price: 950, sector: 'Technology' },
  { code: 'META', name: 'Meta Platforms Inc.', price: 530, sector: 'Technology' },
  { code: 'AMD', name: 'Advanced Micro Devices', price: 170, sector: 'Technology' },
  { code: 'INTC', name: 'Intel Corp.', price: 38, sector: 'Technology' },
  { code: 'NFLX', name: 'Netflix Inc.', price: 650, sector: 'Technology' },
  { code: 'CRM', name: 'Salesforce Inc.', price: 280, sector: 'Technology' },
  { code: 'ADBE', name: 'Adobe Inc.', price: 520, sector: 'Technology' },
  // Finance
  { code: 'JPM', name: 'JPMorgan Chase & Co.', price: 210, sector: 'Finance' },
  { code: 'BAC', name: 'Bank of America Corp.', price: 40, sector: 'Finance' },
  { code: 'GS', name: 'Goldman Sachs Group', price: 470, sector: 'Finance' },
  { code: 'V', name: 'Visa Inc.', price: 285, sector: 'Finance' },
  // Healthcare
  { code: 'JNJ', name: 'Johnson & Johnson', price: 155, sector: 'Healthcare' },
  { code: 'PFE', name: 'Pfizer Inc.', price: 28, sector: 'Healthcare' },
  { code: 'UNH', name: 'UnitedHealth Group', price: 530, sector: 'Healthcare' },
  // Consumer
  { code: 'TSLA', name: 'Tesla Inc.', price: 210, sector: 'Consumer' },
  { code: 'NKE', name: 'Nike Inc.', price: 95, sector: 'Consumer' },
  { code: 'WMT', name: 'Walmart Inc.', price: 165, sector: 'Consumer' },
  { code: 'MCD', name: "McDonald's Corp.", price: 290, sector: 'Consumer' },
  // Industrial
  { code: 'BA', name: 'Boeing Co.', price: 185, sector: 'Industrial' },
  { code: 'CAT', name: 'Caterpillar Inc.', price: 350, sector: 'Industrial' },
  { code: 'GE', name: 'General Electric', price: 170, sector: 'Industrial' },
];

// 有事件数据的股票列表
const STOCKS_WITH_EVENTS = new Set([
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META', 'JPM', 'JNJ', 'BA',
]);

// 获取随机热门股
const getRandomStock = (market: 'cn' | 'us') => {
  const stocks = market === 'cn' ? A_STOCKS : US_STOCKS;
  const randomIndex = Math.floor(Math.random() * stocks.length);
  return stocks[randomIndex];
};

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const [market, setMarket] = useState<'cn' | 'us'>('cn');
  const [symbol, setSymbol] = useState<typeof A_STOCKS[0] | null>(null);
  const [period, setPeriod] = useState('daily');
  const [capital, setCapital] = useState<number>(100000); // 默认10万
  const [capitalUnit, setCapitalUnit] = useState<'cny' | 'usd'>('cny'); // 币种
  const [klineCount, setKlineCount] = useState<number>(100); // 默认100根K线

  // 组件加载时自动选择随机热门股
  useEffect(() => {
    const randomStock = getRandomStock(market);
    setSymbol(randomStock);
  }, [market]);

  // A股 ↔ 美股：自动切换模拟币种，并把资金夹到当前市场滑杆范围内
  useEffect(() => {
    setCapitalUnit(market === 'cn' ? 'cny' : 'usd');
    setCapital((c) => {
      if (market === 'us') {
        return Math.min(100000, Math.max(1000, c));
      }
      return Math.min(1000000, Math.max(10000, c));
    });
  }, [market]);

  const stocks = market === 'cn' ? A_STOCKS : US_STOCKS;

  // 随机选择一只股票
  const handleRandomPick = () => {
    const randomStock = getRandomStock(market);
    setSymbol(randomStock);
  };

  // 处理仓位滑动条变化
  const handleCapitalChange = (_: Event, value: number | number[]) => {
    setCapital(value as number);
  };

  // 处理开始训练
  const handleStartTraining = () => {
    if (!symbol) return;
    
    // 将设置信息存储到 sessionStorage
    sessionStorage.setItem('training_capital', JSON.stringify({
      amount: capital,
      unit: capitalUnit,
    }));
    sessionStorage.setItem('training_kline_count', klineCount.toString());
    
    navigate(`/training/${symbol.code}`);
  };

  // 格式化币种显示
  const formatCapital = (value: number) => {
    if (capitalUnit === 'usd') {
      return `$${(value / 1000).toFixed(1)}K`;
    }
    return `¥${(value / 10000).toFixed(1)}万`;
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h3" component="h1" gutterBottom>
        K-Rhythm - K线训练系统
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={4}>
        基于真实历史行情，训练你的交易直觉
      </Typography>

      <Grid container spacing={3}>
        {/* 左侧设置 */}
        <Grid item xs={12} md={5}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                训练设置
              </Typography>

              {/* 市场选择 */}
              <Box mb={3}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  选择市场
                </Typography>
                <ToggleButtonGroup
                  value={market}
                  exclusive
                  onChange={(_, v) => { if (v) { setMarket(v); } }}
                  fullWidth
                >
                  <ToggleButton value="cn">A股（沪深）</ToggleButton>
                  <ToggleButton value="us">美股</ToggleButton>
                </ToggleButtonGroup>
              </Box>

              {/* 随机选股 */}
              <Box mb={3}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  选股方式
                </Typography>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<Casino />}
                  onClick={handleRandomPick}
                  sx={{ mb: 2 }}
                >
                  🎲 随机抽取热门股
                </Button>
                {symbol && (
                  <Box
                    sx={{
                      p: 2,
                      bgcolor: 'primary.dark',
                      borderRadius: 1,
                      textAlign: 'center',
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      当前选中
                    </Typography>
                    <Typography variant="h6">
                      {symbol.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {symbol.code} · 现价约 {market === 'cn' ? '¥' : '$'}
                      {symbol.price.toFixed(2)}
                    </Typography>
                  </Box>
                )}
              </Box>

              {/* 手动选股 */}
              <Box mb={3}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  或手动选择
                </Typography>
                <Autocomplete
                  options={stocks}
                  getOptionLabel={(option) => `${option.code} - ${option.name}`}
                  value={symbol}
                  onChange={(_, v) => v && setSymbol(v)}
                  renderInput={(params) => (
                    <TextField {...params} placeholder="搜索股票代码或名称" size="small" />
                  )}
                />
              </Box>

              {/* 仓位设置 */}
              <Box mb={3}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  模拟仓位
                </Typography>
                
                {/* 币种切换 */}
                <ToggleButtonGroup
                  value={capitalUnit}
                  exclusive
                  onChange={(_, v) => v && setCapitalUnit(v)}
                  size="small"
                  fullWidth
                  sx={{ mb: 2 }}
                >
                  <ToggleButton value="cny">人民币 (¥)</ToggleButton>
                  <ToggleButton value="usd">美元 ($)</ToggleButton>
                </ToggleButtonGroup>

                {/* 仓位滑动条 */}
                <Box px={1}>
                  <Slider
                    value={capital}
                    onChange={handleCapitalChange}
                    min={capitalUnit === 'usd' ? 1000 : 10000}
                    max={capitalUnit === 'usd' ? 100000 : 1000000}
                    step={capitalUnit === 'usd' ? 1000 : 10000}
                    valueLabelDisplay="on"
                    valueLabelFormat={formatCapital}
                    marks={capitalUnit === 'usd' ? [
                      { value: 1000, label: '$1K' },
                      { value: 10000, label: '$10K' },
                      { value: 50000, label: '$50K' },
                      { value: 100000, label: '$100K' },
                    ] : [
                      { value: 10000, label: '¥1万' },
                      { value: 100000, label: '¥10万' },
                      { value: 500000, label: '¥50万' },
                      { value: 1000000, label: '¥100万' },
                    ]}
                  />
                </Box>

                <Box display="flex" justifyContent="space-between" alignItems="center" mt={1}>
                  <Typography variant="body2" color="text.secondary">
                    模拟资金
                  </Typography>
                  <Typography variant="h5" color="primary">
                    {capitalUnit === 'usd' ? '$' : '¥'}{capital.toLocaleString()}
                  </Typography>
                </Box>
              </Box>

              {/* K线数量选择 */}
              <Box mb={3}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  决策K线数量（买/卖/观望）
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                  历史K线会自动从左侧加载满
                </Typography>
                <ToggleButtonGroup
                  value={klineCount}
                  exclusive
                  onChange={(_, v) => v && setKlineCount(v)}
                  fullWidth
                >
                  <ToggleButton value={50}>50根</ToggleButton>
                  <ToggleButton value={100}>100根</ToggleButton>
                  <ToggleButton value={300}>300根</ToggleButton>
                  <ToggleButton value={500}>500根</ToggleButton>
                </ToggleButtonGroup>
              </Box>

              {/* 周期选择 */}
              <Box mb={3}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  K线周期
                </Typography>
                <ToggleButtonGroup
                  value={period}
                  exclusive
                  onChange={(_, v) => v && setPeriod(v)}
                  fullWidth
                >
                  <ToggleButton value="daily">日K</ToggleButton>
                  <ToggleButton value="weekly">周K</ToggleButton>
                  <ToggleButton value="60min">60分钟</ToggleButton>
                </ToggleButtonGroup>
              </Box>

              <Button
                variant="contained"
                size="large"
                fullWidth
                startIcon={<PlayArrow />}
                onClick={handleStartTraining}
                disabled={!symbol}
              >
                开始训练 {symbol ? `- ${symbol.name}` : ''}
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* 右侧热门品种 */}
        <Grid item xs={12} md={7}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">
                  {market === 'cn' ? 'A股' : '美股'}热门品种
                </Typography>
                <Box display="flex" alignItems="center" gap={1}>
                  <Chip
                    label={`${stocks.length} 只股票`}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                  {market === 'us' && (
                    <Chip
                      label={`${STOCKS_WITH_EVENTS.size} 只有事件数据`}
                      size="small"
                      color="warning"
                      variant="outlined"
                      sx={{ fontSize: '0.7rem' }}
                    />
                  )}
                </Box>
              </Box>
              {market === 'us' ? (
                // 美股按行业分组显示
                (['Technology', 'Finance', 'Healthcare', 'Consumer', 'Industrial'] as const).map((sector) => {
                  const sectorStocks = stocks.filter((s) => (s as any).sector === sector);
                  if (sectorStocks.length === 0) return null;
                  return (
                    <Box key={sector} mb={2}>
                      <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                        {sector}
                      </Typography>
                      <Box display="flex" flexWrap="wrap" gap={1}>
                        {sectorStocks.map((stock) => (
                          <Chip
                            key={stock.code}
                            label={
                              <Box display="flex" alignItems="center" gap={0.5}>
                                <Typography variant="body2" component="span" fontWeight="bold">
                                  {stock.code}
                                </Typography>
                                <Typography variant="caption" component="span" sx={{ opacity: 0.7 }}>
                                  {stock.name}
                                </Typography>
                                {STOCKS_WITH_EVENTS.has(stock.code) && (
                                  <Box
                                    component="span"
                                    sx={{
                                      width: 6,
                                      height: 6,
                                      borderRadius: '50%',
                                      bgcolor: 'warning.main',
                                      display: 'inline-block',
                                      ml: 0.25,
                                    }}
                                    title="Has event data"
                                  />
                                )}
                              </Box>
                            }
                            onClick={() => setSymbol(stock)}
                            variant={symbol?.code === stock.code ? 'filled' : 'outlined'}
                            color={symbol?.code === stock.code ? 'primary' : 'default'}
                            sx={{
                              cursor: 'pointer',
                              '& .MuiChip-label': { px: 1.5, py: 0.5 }
                            }}
                          />
                        ))}
                      </Box>
                    </Box>
                  );
                })
              ) : (
                // A股列表（保持原样）
                <Box display="flex" flexWrap="wrap" gap={1}>
                  {stocks.map((stock) => (
                    <Chip
                      key={stock.code}
                      label={
                        <Box>
                          <Typography variant="body2" component="span" fontWeight="bold">
                            {stock.code}
                          </Typography>
                          <Typography variant="caption" component="span" sx={{ ml: 0.5, opacity: 0.7 }}>
                            {stock.name}
                          </Typography>
                        </Box>
                      }
                      onClick={() => setSymbol(stock)}
                      variant={symbol?.code === stock.code ? 'filled' : 'outlined'}
                      color={symbol?.code === stock.code ? 'primary' : 'default'}
                      sx={{
                        cursor: 'pointer',
                        '& .MuiChip-label': { px: 1.5, py: 0.5 }
                      }}
                    />
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>

          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                使用说明
              </Typography>
              <Typography variant="body2" paragraph>
                1. 选择市场（A股/美股）
              </Typography>
              <Typography variant="body2" paragraph>
                2. 点击"随机抽取"或手动选择股票
              </Typography>
              <Typography variant="body2" paragraph>
                3. 设置模拟仓位（人民币或美元）
              </Typography>
              <Typography variant="body2" paragraph>
                4. 点击"开始训练"进入训练页面
              </Typography>
              <Typography variant="body2" paragraph>
                5. 通过"下一根K线"按钮逐步揭示行情
              </Typography>
              <Typography variant="body2">
                6. 根据已揭示的K线形态做出买卖决策
              </Typography>
            </CardContent>
          </Card>

          {/* 热门股票池 */}
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                💡 训练小贴士
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                • 建议从日K开始训练，熟悉基本K线形态
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                • 初学者建议设置较小仓位，熟练后再增加
              </Typography>
              <Typography variant="body2" color="text.secondary">
                • 每次训练建议 50-100 根K线，训练后查看复盘
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
};
