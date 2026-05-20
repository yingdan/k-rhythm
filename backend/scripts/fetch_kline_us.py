"""
美股K线数据获取脚本
使用 yfinance 获取美股历史K线数据，支持多周期和批量下载
"""
import os
import sys
import argparse
import time
import pandas as pd
import yfinance as yf
from datetime import datetime, timedelta
from typing import Optional

PARQUET_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "parquet", "us")

# 热门美股列表
POPULAR_US_STOCKS = [
    # 科技
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "AMD", "INTC", "CRM", "ADBE",
    "NFLX", "ORCL", "CSCO", "QCOM", "TXN", "AVGO", "NOW", "IBM", "UBER", "PYPL",
    # 金融
    "JPM", "BAC", "GS", "V", "MA", "WFC", "MS", "BLK", "AXP", "C",
    # 医疗
    "JNJ", "PFE", "UNH", "ABBV", "MRK", "ABT", "TMO", "LLY", "BMY", "AMGN",
    # 消费
    "TSLA", "NKE", "WMT", "MCD", "SBUX", "HD", "LOW", "COST", "TGT", "DIS",
    # 工业
    "BA", "CAT", "GE", "MMM", "HON", "UPS", "RTX", "LMT", "DE", "UNP",
]

PERIOD_MAP = {
    "daily": "1d",
    "weekly": "1wk",
    "monthly": "1mo",
    "60min": "60m",
    "30min": "30m",
}


def fetch_stock_data(
    symbol: str,
    period: str = "daily",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    max_retries: int = 3,
) -> pd.DataFrame:
    """
    Fetch US stock historical K-line data from yfinance.

    Args:
        symbol: Stock ticker, e.g. 'AAPL'
        period: 'daily', 'weekly', 'monthly', '60min', '30min'
        start_date: YYYY-MM-DD
        end_date: YYYY-MM-DD
        max_retries: Number of retry attempts on failure
    """
    if start_date is None:
        start_date = (datetime.now() - timedelta(days=3650)).strftime("%Y-%m-%d")
    if end_date is None:
        end_date = datetime.now().strftime("%Y-%m-%d")

    interval = PERIOD_MAP.get(period, "1d")

    for attempt in range(max_retries):
        try:
            ticker = yf.Ticker(symbol)
            df = ticker.history(start=start_date, end=end_date, interval=interval)

            if df.empty:
                print(f"  [{symbol}] No data returned (attempt {attempt+1}/{max_retries})")
                if attempt < max_retries - 1:
                    time.sleep(2)
                    continue
                return pd.DataFrame()

            df = df.reset_index()

            # Normalize column names (yfinance may return 'Date' or 'Datetime')
            date_col = df.columns[0]
            df = df.rename(columns={
                date_col: "date",
                "Open": "open",
                "High": "high",
                "Low": "low",
                "Close": "close",
                "Volume": "volume",
            })

            # Keep only OHLCV columns
            required_cols = ["date", "open", "high", "low", "close", "volume"]
            df = df[[c for c in required_cols if c in df.columns]]

            df["date"] = pd.to_datetime(df["date"])
            df = df.sort_values("date").reset_index(drop=True)
            df = df.drop_duplicates(subset=["date"]).reset_index(drop=True)

            # Fill any missing OHLCV values
            for col in ["open", "high", "low", "close"]:
                if col in df.columns:
                    df[col] = df[col].fillna(method="ffill").fillna(method="bfill")
            if "volume" in df.columns:
                df["volume"] = df["volume"].fillna(0).astype(int)

            return df

        except Exception as e:
            print(f"  [{symbol}] Error (attempt {attempt+1}/{max_retries}): {e}")
            if attempt < max_retries - 1:
                time.sleep(2)

    return pd.DataFrame()


def save_to_parquet(df: pd.DataFrame, symbol: str, period: str = "daily", market: str = "us"):
    """Save DataFrame as Snappy-compressed Parquet file."""
    if df.empty:
        return None

    os.makedirs(PARQUET_DIR, exist_ok=True)
    filename = f"{market}_{symbol}_{period}.parquet"
    filepath = os.path.join(PARQUET_DIR, filename)
    df.to_parquet(filepath, engine="pyarrow", compression="snappy")
    return filepath


def fetch_and_save(
    symbol: str,
    period: str = "daily",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> Optional[str]:
    """Fetch data for a single symbol and save to Parquet."""
    print(f"[{symbol}] Fetching {period} data...")
    df = fetch_stock_data(symbol, period, start_date, end_date)
    if df.empty:
        print(f"  [{symbol}] No data available")
        return None

    filepath = save_to_parquet(df, symbol, period)
    if filepath:
        first_date = df["date"].iloc[0].strftime("%Y-%m-%d")
        last_date = df["date"].iloc[-1].strftime("%Y-%m-%d")
        print(f"  [{symbol}] Saved {len(df)} bars ({first_date} ~ {last_date}) -> {filepath}")
    return filepath


def batch_fetch(
    symbols: list,
    period: str = "daily",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    delay: float = 1.0,
):
    """Fetch data for multiple symbols sequentially."""
    results = {"success": [], "failed": []}
    total = len(symbols)

    for i, symbol in enumerate(symbols):
        print(f"\n[{i+1}/{total}] Processing {symbol}...")
        filepath = fetch_and_save(symbol, period, start_date, end_date)
        if filepath:
            results["success"].append({"symbol": symbol, "filepath": filepath})
        else:
            results["failed"].append(symbol)

        if i < total - 1:
            time.sleep(delay)

    print(f"\n{'='*50}")
    print(f"Batch complete: {len(results['success'])} success, {len(results['failed'])} failed")
    if results["failed"]:
        print(f"Failed: {', '.join(results['failed'])}")
    return results


def main():
    parser = argparse.ArgumentParser(description="Fetch US stock K-line data via yfinance")
    parser.add_argument("--symbol", "-s", type=str, help="Single stock ticker (e.g., AAPL)")
    parser.add_argument("--period", "-p", type=str, default="daily",
                        choices=["daily", "weekly", "monthly", "60min", "30min"],
                        help="K-line period (default: daily)")
    parser.add_argument("--start", type=str, help="Start date YYYY-MM-DD (default: 10 years ago)")
    parser.add_argument("--end", type=str, help="End date YYYY-MM-DD (default: today)")
    parser.add_argument("--batch", "-b", action="store_true",
                        help="Batch fetch all popular US stocks")
    parser.add_argument("--popular", action="store_true",
                        help="Fetch top 20 popular US stocks")
    parser.add_argument("--delay", type=float, default=1.0,
                        help="Delay between requests in seconds (default: 1.0)")

    args = parser.parse_args()

    if args.batch:
        batch_fetch(POPULAR_US_STOCKS, args.period, args.start, args.end, args.delay)
    elif args.popular:
        batch_fetch(POPULAR_US_STOCKS[:20], args.period, args.start, args.end, args.delay)
    elif args.symbol:
        fetch_and_save(args.symbol, args.period, args.start, args.end)
    else:
        parser.print_help()
        print(f"\nAvailable stocks ({len(POPULAR_US_STOCKS)}):")
        for i, s in enumerate(POPULAR_US_STOCKS):
            print(f"  {s}", end="")
            if (i + 1) % 10 == 0:
                print()
        print()


if __name__ == "__main__":
    main()
