"""
美股数据初始化脚本
下载热门美股K线数据，并验证事件数据库
"""
import os
import sys
import time
import argparse

# Add backend directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from scripts.fetch_kline_us import fetch_and_save, batch_fetch, POPULAR_US_STOCKS
from app.services.us_event_service import (
    _load_events,
    get_events_for_symbol,
    get_macro_events,
)

# Stocks with rich event data
EVENT_STOCKS = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META", "JPM", "JNJ", "BA"]


def verify_events():
    """Verify events database integrity."""
    print("\n" + "=" * 50)
    print("VERIFYING EVENTS DATABASE")
    print("=" * 50)

    events = _load_events()
    if not events:
        print("WARNING: No events found in us_events.json!")
        return False

    print(f"Total events: {len(events)}")

    # Check event types
    types = {}
    for e in events:
        t = e["type"]
        types[t] = types.get(t, 0) + 1
    for t, c in sorted(types.items()):
        print(f"  {t}: {c}")

    # Check stock coverage
    stocks_with_events = {}
    for e in events:
        s = e["symbol"]
        stocks_with_events[s] = stocks_with_events.get(s, 0) + 1

    print(f"\nStocks covered: {len(stocks_with_events)}")
    for s in EVENT_STOCKS:
        count = stocks_with_events.get(s, 0)
        status = "OK" if count > 0 else "MISSING"
        print(f"  {s}: {count} events [{status}]")

    macro_count = stocks_with_events.get("MACRO", 0)
    print(f"  MACRO (economic): {macro_count} events")

    return True


def main():
    parser = argparse.ArgumentParser(
        description="Initialize US stock data (K-line + verify events)"
    )
    parser.add_argument(
        "--kline",
        action="store_true",
        default=True,
        help="Download K-line data for popular US stocks",
    )
    parser.add_argument(
        "--skip-kline",
        action="store_true",
        help="Skip K-line data download, only verify events",
    )
    parser.add_argument(
        "--top",
        type=int,
        default=20,
        help="Number of top stocks to download (default: 20)",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=1.5,
        help="Delay between requests in seconds (default: 1.5)",
    )
    parser.add_argument(
        "--verify-only",
        action="store_true",
        help="Only verify existing data, don't download anything",
    )

    args = parser.parse_args()

    print("K-Rhythm US Stock Data Initialization")
    print("=" * 50)

    # Verify events
    verify_events()

    if args.verify_only:
        # Check existing Parquet files
        print("\n" + "=" * 50)
        print("CHECKING PARQUET FILES")
        print("=" * 50)
        parquet_dir = os.path.join(
            os.path.dirname(__file__), "..", "data", "parquet", "us"
        )
        if os.path.exists(parquet_dir):
            files = [f for f in os.listdir(parquet_dir) if f.endswith(".parquet")]
            print(f"Existing Parquet files: {len(files)}")
            for f in sorted(files):
                size_kb = os.path.getsize(os.path.join(parquet_dir, f)) / 1024
                print(f"  {f} ({size_kb:.1f} KB)")
        else:
            print("No parquet directory found.")
        return

    if args.skip_kline:
        print("\nSkipping K-line data download.")
        return

    # Download K-line data
    symbols = POPULAR_US_STOCKS[: args.top]
    print(f"\nDownloading K-line data for {len(symbols)} stocks...")
    print(f"Delay between requests: {args.delay}s")

    if args.top <= 5:
        # For small batches, fetch one by one
        results = {"success": [], "failed": []}
        for sym in symbols:
            filepath = fetch_and_save(sym, "daily")
            if filepath:
                results["success"].append({"symbol": sym, "filepath": filepath})
            else:
                results["failed"].append(sym)
            time.sleep(args.delay)
    else:
        results = batch_fetch(symbols, "daily", delay=args.delay)

    print("\n" + "=" * 50)
    print("INITIALIZATION COMPLETE")
    print("=" * 50)
    print(f"K-line data: {len(results['success'])} success, {len(results['failed'])} failed")
    if results["failed"]:
        print(f"Failed: {', '.join(results['failed'])}")

    # Summary
    print("\nNext steps:")
    print("  1. Start the backend: cd backend && uvicorn app.main:app --reload")
    print("  2. Start the frontend: cd frontend && npm run dev")
    print("  3. Open http://localhost:3000, select '美股' market, and start training!")


if __name__ == "__main__":
    main()
