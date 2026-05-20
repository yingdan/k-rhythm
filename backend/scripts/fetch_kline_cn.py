"""
A股K线数据获取脚本
使用 AKShare 获取沪深股票历史K线数据
"""
import os
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
from datetime import datetime, timedelta
import akshare as ak

PARQUET_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "parquet", "cn")

def fetch_stock_daily(symbol: str, start_date: str = None, end_date: str = None) -> pd.DataFrame:
    """
    获取A股日K数据
    symbol: 股票代码，如 '600000'（浦发银行）
    """
    if start_date is None:
        start_date = (datetime.now() - timedelta(days=3650)).strftime("%Y%m%d")  # 10年数据
    if end_date is None:
        end_date = datetime.now().strftime("%Y%m%d")
    
    try:
        df = ak.stock_zh_a_hist(symbol=symbol, period="daily", start_date=start_date, end_date=end_date)
        df = df.rename(columns={
            '日期': 'date',
            '开盘': 'open',
            '收盘': 'close',
            '最高': 'high',
            '最低': 'low',
            '成交量': 'volume',
            '成交额': 'turnover',
            '振幅': 'amplitude',
            '涨跌幅': 'pct_change',
            '涨跌额': 'price_change',
            '换手率': 'turnover_rate'
        })
        df['date'] = pd.to_datetime(df['date'])
        df = df.sort_values('date').reset_index(drop=True)
        return df
    except Exception as e:
        print(f"Error fetching {symbol}: {e}")
        return pd.DataFrame()

def save_to_parquet(df: pd.DataFrame, symbol: str, market: str = "cn"):
    """保存为 Parquet 文件"""
    if df.empty:
        return
    
    symbol_formatted = symbol.replace(".", "_")
    filename = f"{market}_{symbol_formatted}_daily.parquet"
    filepath = os.path.join(PARQUET_DIR, filename)
    
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    df.to_parquet(filepath, engine='pyarrow', compression='snappy')
    print(f"Saved {symbol} to {filepath}")

if __name__ == "__main__":
    # 测试：获取浦发银行日K数据
    df = fetch_stock_daily("600000")
    if not df.empty:
        save_to_parquet(df, "600000.SH")
        print(df.tail())
