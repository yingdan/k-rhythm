from fastapi import APIRouter, HTTPException, Depends
from fastapi import Query
from pydantic import BaseModel
from typing import Optional
import pandas as pd
import os
import random
import math
import hashlib
import pyarrow.parquet as pq
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.services.us_event_service import get_events_for_kline_range

router = APIRouter(prefix="/kline", tags=["K线数据"])

KLINE_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data", "parquet")

# ── 高质量模拟K线生成器（网络不可用时的后备方案）──

# 每只股票的特征参数（基于真实历史波动特征）
_STOCK_PROFILES = {
    "AAPL": {"base_price": 185, "drift": 0.0003, "volatility": 0.018, "volume_base": 55_000_000},
    "MSFT": {"base_price": 415, "drift": 0.0004, "volatility": 0.016, "volume_base": 22_000_000},
    "GOOGL": {"base_price": 175, "drift": 0.0002, "volatility": 0.020, "volume_base": 25_000_000},
    "AMZN": {"base_price": 195, "drift": 0.0003, "volatility": 0.022, "volume_base": 40_000_000},
    "NVDA": {"base_price": 875, "drift": 0.0006, "volatility": 0.035, "volume_base": 50_000_000},
    "META": {"base_price": 520, "drift": 0.0004, "volatility": 0.028, "volume_base": 15_000_000},
    "TSLA": {"base_price": 245, "drift": 0.0002, "volatility": 0.040, "volume_base": 100_000_000},
    "JPM": {"base_price": 195, "drift": 0.0002, "volatility": 0.015, "volume_base": 10_000_000},
    "JNJ": {"base_price": 155, "drift": 0.0001, "volatility": 0.012, "volume_base": 8_000_000},
    "BA":   {"base_price": 185, "drift": 0.0000, "volatility": 0.025, "volume_base": 7_000_000},
}
_DEFAULT_PROFILE = {"base_price": 100, "drift": 0.0002, "volatility": 0.020, "volume_base": 10_000_000}

def _seed(symbol: str) -> int:
    """用股票代码生成可复现的随机种子"""
    return int(hashlib.md5(symbol.encode()).hexdigest()[:8], 16)

def generate_realistic_kline(symbol_code: str, num_bars: int = 2500) -> list:
    """
    生成高质量模拟K线数据。
    - 基于种子保证同一股票每次生成的数据一致
    - 使用几何布朗运动 + 实际波动率
    - 生成真实OHLCV
    """
    symbol = symbol_code.replace(".US", "").replace(".SH", "").replace(".SZ", "").upper()
    profile = _STOCK_PROFILES.get(symbol, _DEFAULT_PROFILE)
    rng = random.Random(_seed(symbol))

    base = profile["base_price"]
    drift = profile["drift"]
    vol = profile["volatility"]
    vol_base = profile["volume_base"]

    bars = []
    price = base
    # 起始日期：num_bars 个交易日前
    end_date = datetime.now()
    current_date = end_date - timedelta(days=int(num_bars * 1.4))  # 近似考虑周末

    for i in range(num_bars):
        # 跳过周末
        while current_date.weekday() >= 5:
            current_date += timedelta(days=1)

        # 几何布朗运动日收益率
        daily_return = rng.gauss(drift, vol)
        close = price * (1 + daily_return)
        close = max(close, price * 0.001)  # 防止归零

        # 日内波动：开盘在前日收盘附近，高低在日内波动范围内
        intraday_range = close * vol * abs(rng.gauss(0.5, 0.3))
        intraday_range = max(intraday_range, close * 0.002)

        open_price = price + rng.uniform(-0.3, 0.3) * intraday_range
        high = max(open_price, close) + rng.uniform(0, 0.5) * intraday_range
        low = min(open_price, close) - rng.uniform(0, 0.5) * intraday_range
        low = max(low, close * 0.001)

        # 成交量：基础量 + 波动加成
        vol_multiplier = 1.0 + abs(daily_return) / vol * 2.0
        volume = int(vol_base * vol_multiplier * rng.uniform(0.5, 1.5))
        volume = max(volume, 1000)

        bars.append({
            "timestamp": current_date.strftime("%Y-%m-%d"),
            "open": round(open_price, 2),
            "high": round(high, 2),
            "low": round(low, 2),
            "close": round(close, 2),
            "volume": volume,
        })

        price = close
        current_date += timedelta(days=1)

    return bars

# 热门美股列表
POPULAR_US_STOCKS = [
    {"code": "AAPL", "name": "Apple Inc.", "sector": "Technology"},
    {"code": "MSFT", "name": "Microsoft Corp.", "sector": "Technology"},
    {"code": "GOOGL", "name": "Alphabet Inc.", "sector": "Technology"},
    {"code": "AMZN", "name": "Amazon.com Inc.", "sector": "Technology"},
    {"code": "NVDA", "name": "NVIDIA Corp.", "sector": "Technology"},
    {"code": "META", "name": "Meta Platforms Inc.", "sector": "Technology"},
    {"code": "TSLA", "name": "Tesla Inc.", "sector": "Consumer"},
    {"code": "AMD", "name": "Advanced Micro Devices", "sector": "Technology"},
    {"code": "INTC", "name": "Intel Corp.", "sector": "Technology"},
    {"code": "NFLX", "name": "Netflix Inc.", "sector": "Technology"},
    {"code": "CRM", "name": "Salesforce Inc.", "sector": "Technology"},
    {"code": "ADBE", "name": "Adobe Inc.", "sector": "Technology"},
    {"code": "JPM", "name": "JPMorgan Chase & Co.", "sector": "Finance"},
    {"code": "BAC", "name": "Bank of America Corp.", "sector": "Finance"},
    {"code": "GS", "name": "Goldman Sachs Group", "sector": "Finance"},
    {"code": "V", "name": "Visa Inc.", "sector": "Finance"},
    {"code": "JNJ", "name": "Johnson & Johnson", "sector": "Healthcare"},
    {"code": "PFE", "name": "Pfizer Inc.", "sector": "Healthcare"},
    {"code": "UNH", "name": "UnitedHealth Group", "sector": "Healthcare"},
    {"code": "BA", "name": "Boeing Co.", "sector": "Industrial"},
    {"code": "CAT", "name": "Caterpillar Inc.", "sector": "Industrial"},
    {"code": "GE", "name": "General Electric", "sector": "Industrial"},
    {"code": "WMT", "name": "Walmart Inc.", "sector": "Consumer"},
    {"code": "NKE", "name": "Nike Inc.", "sector": "Consumer"},
    {"code": "MCD", "name": "McDonald's Corp.", "sector": "Consumer"},
]

class KlineBar(BaseModel):
    timestamp: str
    open: float
    high: float
    low: float
    close: float
    volume: float

def get_parquet_path(symbol_code: str, period: str = "daily") -> str:
    """获取 Parquet 文件路径"""
    market = "cn" if ".SH" in symbol_code or ".SZ" in symbol_code else "us"
    symbol = symbol_code.replace(".", "_")
    return os.path.join(KLINE_DIR, market, f"{market}_{symbol}_{period}.parquet")

def is_us_symbol(symbol_code: str) -> bool:
    return not (".SH" in symbol_code or ".SZ" in symbol_code)

def fetch_from_yfinance(symbol_code: str, period: str = "daily") -> list:
    """使用yfinance获取美股K线数据（备选方案）"""
    try:
        import yfinance as yf
    except ImportError:
        return []

    symbol = symbol_code.replace(".US", "").upper()

    interval_map = {
        "daily": "1d",
        "weekly": "1wk",
        "monthly": "1mo",
        "60min": "60m",
    }
    interval = interval_map.get(period, "1d")

    try:
        ticker = yf.Ticker(symbol)
        end = datetime.now()
        start = end - timedelta(days=3650)
        df = ticker.history(start=start.strftime("%Y-%m-%d"),
                           end=end.strftime("%Y-%m-%d"),
                           interval=interval)

        if df.empty:
            return []

        df = df.reset_index()
        date_col = df.columns[0]

        bars = []
        for _, row in df.iterrows():
            ts = row[date_col]
            if hasattr(ts, 'isoformat'):
                ts = ts.isoformat()
            bars.append({
                "timestamp": str(ts),
                "open": float(row["Open"]),
                "high": float(row["High"]),
                "low": float(row["Low"]),
                "close": float(row["Close"]),
                "volume": float(row["Volume"]) if pd.notna(row["Volume"]) else 0,
            })
        return bars
    except Exception as e:
        print(f"yfinance error for {symbol}: {e}")
        return []


def fetch_us_from_akshare(symbol_code: str, period: str = "daily") -> list:
    """使用AKShare东方财富接口获取美股K线数据（主力方案）"""
    import akshare as ak

    symbol = symbol_code.replace(".US", "").upper()

    # AKShare 美股格式: {market}.{symbol}
    # 105 = NASDAQ, 106 = NYSE, 107 = AMEX
    # 大部分热门科技股在 NASDAQ (105)
    ak_symbols = [f"105.{symbol}", f"106.{symbol}", f"107.{symbol}"]

    for ak_sym in ak_symbols:
        try:
            df = ak.stock_us_hist(
                symbol=ak_sym,
                period=period,
                start_date="20150101",
                end_date="20301231",
                adjust="qfq",
            )
            if df is None or df.empty:
                continue

            # AKShare 返回中文列名: 日期/开盘/最高/最低/收盘/成交量/成交额/振幅/涨跌幅/涨跌额/换手率
            col_map = {
                "日期": "date",
                "开盘": "open",
                "最高": "high",
                "最低": "low",
                "收盘": "close",
                "成交量": "volume",
            }
            df = df.rename(columns=col_map)
            required = ["date", "open", "high", "low", "close"]
            if not all(c in df.columns for c in required):
                continue

            bars = []
            for _, row in df.iterrows():
                bars.append({
                    "timestamp": str(row["date"]),
                    "open": float(row["open"]),
                    "high": float(row["high"]),
                    "low": float(row["low"]),
                    "close": float(row["close"]),
                    "volume": float(row["volume"]) if "volume" in df.columns and pd.notna(row["volume"]) else 0,
                })
            if bars:
                return bars
        except Exception as e:
            print(f"AKShare error for {ak_sym}: {e}")
            continue

    return []

def fetch_from_akshare(symbol_code: str, period: str = "daily") -> list:
    """使用AKShare获取K线数据（A股专用）"""
    import akshare as ak

    is_cn = ".SH" in symbol_code or ".SZ" in symbol_code

    if is_cn:
        symbol = symbol_code.split('.')[0]
        try:
            df = ak.stock_zh_a_hist(symbol=symbol, period="daily",
                                   start_date="20200101", end_date="20300101", adjust="qfq")
            df = df[['日期', '开盘', '最高', '最低', '收盘', '成交量']]
            df.columns = ['date', 'open', 'high', 'low', 'close', 'volume']
        except Exception:
            df = ak.stock_zh_index_daily(symbol=f"sh{symbol}" if symbol.startswith('6') else f"sz{symbol}")
            df = df.tail(500)
    else:
        return []

    bars = []
    for _, row in df.iterrows():
        bars.append({
            "timestamp": str(row['date']),
            "open": float(row['open']),
            "high": float(row['high']),
            "low": float(row['low']),
            "close": float(row['close']),
            "volume": float(row['volume']) if pd.notna(row['volume']) else 0
        })
    return bars

def read_bars_from_parquet(filepath: str, from_index: int = None, to_index: int = None) -> list:
    """从Parquet文件读取K线数据"""
    pf = pq.ParquetFile(filepath)
    df = pf.read_pandas().to_pandas()

    if from_index is not None and to_index is not None:
        df = df.iloc[from_index:to_index]

    date_col = 'date' if 'date' in df.columns else ('datetime' if 'datetime' in df.columns else df.columns[0])

    bars = []
    for _, row in df.iterrows():
        bars.append({
            "timestamp": row[date_col].isoformat() if hasattr(row[date_col], 'isoformat') else str(row[date_col]),
            "open": float(row['open']),
            "high": float(row['high']),
            "low": float(row['low']),
            "close": float(row['close']),
            "volume": float(row['volume']),
        })
    return bars

def fetch_us_kline(symbol_code: str, period: str = "daily") -> list:
    """获取美股K线数据：本地Parquet优先 → AKShare → yfinance"""
    # 1. 优先从 Parquet 本地文件读取（毫秒级）
    filepath = get_parquet_path(symbol_code, period)
    if os.path.exists(filepath):
        try:
            bars = read_bars_from_parquet(filepath)
            if bars:
                return bars
        except Exception:
            pass

    # 2. 使用 AKShare 东方财富接口获取（主力在线源）
    bars = fetch_us_from_akshare(symbol_code, period)
    if bars:
        return bars

    # 3. 使用 yfinance 作为最后备选
    bars = fetch_from_yfinance(symbol_code, period)
    if bars:
        return bars

    return []

@router.get("/us/popular", response_model=dict)
async def get_popular_us_stocks():
    """获取热门美股列表"""
    return {
        "code": 200,
        "message": "success",
        "data": {
            "stocks": POPULAR_US_STOCKS,
            "total": len(POPULAR_US_STOCKS),
        }
    }

@router.get("/{symbol_code}", response_model=dict)
async def get_kline_data(
    symbol_code: str,
    period: str = "daily",
    from_index: Optional[int] = Query(None),
    to_index: Optional[int] = Query(None),
    include_events: bool = Query(False),
    db: AsyncSession = Depends(get_db)
):
    """获取K线数据，支持美股事件嵌入"""
    bars = []

    if is_us_symbol(symbol_code):
        # 美股：本地Parquet优先 → AKShare → yfinance
        filepath = get_parquet_path(symbol_code, period)
        if os.path.exists(filepath):
            try:
                bars = read_bars_from_parquet(filepath, from_index, to_index)
            except Exception:
                pass
        if not bars:
            bars = fetch_us_kline(symbol_code, period)
    else:
        # A股：从Parquet或AKShare
        filepath = get_parquet_path(symbol_code, period)
        if os.path.exists(filepath):
            bars = read_bars_from_parquet(filepath, from_index, to_index)
        else:
            try:
                bars = fetch_from_akshare(symbol_code, period)
            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"获取K线数据失败: {str(e)}")

    if not bars:
        # 后备：生成高质量模拟数据（网络不可用时保证可用）
        bars = generate_realistic_kline(symbol_code, 2500)
        result = {"code": 200, "message": "success (simulated)", "data": {"bars": bars, "total": len(bars)}}
        if include_events and is_us_symbol(symbol_code):
            events = get_events_for_kline_range(symbol_code, bars)
            if events:
                result["data"]["events"] = events
        return result

    result = {"code": 200, "message": "success", "data": {"bars": bars, "total": len(bars)}}

    if include_events and is_us_symbol(symbol_code):
        events = get_events_for_kline_range(symbol_code, bars)
        if events:
            result["data"]["events"] = events

    return result

@router.get("/{symbol_code}/bar/{index}", response_model=dict)
async def get_single_bar(symbol_code: str, index: int, period: str = "daily"):
    """获取单根K线"""
    bars = []

    if is_us_symbol(symbol_code):
        filepath = get_parquet_path(symbol_code, period)
        if os.path.exists(filepath):
            try:
                all_bars = read_bars_from_parquet(filepath)
                if 0 <= index < len(all_bars):
                    bars = [all_bars[index]]
            except Exception:
                pass
        if not bars:
            all_bars = fetch_us_kline(symbol_code, period)
            if 0 <= index < len(all_bars):
                bars = [all_bars[index]]
    else:
        try:
            bars = fetch_from_akshare(symbol_code, period)
        except Exception:
            raise HTTPException(status_code=404, detail="K线数据不存在")

    if not bars:
        bars = generate_realistic_kline(symbol_code, 2500)

    if index < 0 or index >= len(bars):
        raise HTTPException(status_code=404, detail="K线索引超出范围")

    bar = bars[index]
    return {
        "code": 200,
        "message": "success",
        "data": {"index": index, **bar},
    }
