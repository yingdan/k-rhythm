import json
import os
from datetime import datetime, date
from functools import lru_cache
from typing import Optional

EVENTS_FILE = os.path.join(
    os.path.dirname(__file__), "..", "..", "data", "events", "us_events.json"
)

_event_cache: Optional[list] = None
_cache_mtime: float = 0


def _load_events() -> list:
    global _event_cache, _cache_mtime
    try:
        mtime = os.path.getmtime(EVENTS_FILE)
    except OSError:
        return []
    if _event_cache is not None and mtime == _cache_mtime:
        return _event_cache
    with open(EVENTS_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    _event_cache = data.get("events", [])
    _cache_mtime = mtime
    return _event_cache


def _parse_date(d: str) -> date:
    return datetime.strptime(d, "%Y-%m-%d").date()


def get_events_for_symbol(symbol: str) -> list:
    """Get all events for a specific stock symbol (case-insensitive)."""
    events = _load_events()
    symbol_upper = symbol.upper().replace(".US", "")
    return [e for e in events if e["symbol"].upper() == symbol_upper]


def get_macro_events() -> list:
    """Get all macroeconomic and Fed events."""
    events = _load_events()
    return [e for e in events if e["symbol"] == "MACRO"]


def get_events_in_range(start_date: str, end_date: str, symbol: Optional[str] = None) -> list:
    """Get events within a date range, optionally filtered by symbol."""
    events = _load_events()
    start = _parse_date(start_date)
    end = _parse_date(end_date)

    result = []
    for e in events:
        event_date = _parse_date(e["date"])
        if start <= event_date <= end:
            if symbol is None or e["symbol"].upper() == symbol.upper().replace(".US", ""):
                result.append(e)
    result.sort(key=lambda e: e["date"])
    return result


def get_events_for_kline_range(
    symbol: str, bars: list
) -> list:
    """Get events that fall within the date range of provided K-line bars."""
    if not bars:
        return []
    start_date = bars[0]["timestamp"][:10] if isinstance(bars[0].get("timestamp"), str) else str(bars[0]["timestamp"])[:10]
    end_date = bars[-1]["timestamp"][:10] if isinstance(bars[-1].get("timestamp"), str) else str(bars[-1]["timestamp"])[:10]
    return get_events_in_range(start_date, end_date, symbol)


def get_event_types() -> list:
    """Get available event types with counts."""
    events = _load_events()
    type_counts = {}
    for e in events:
        t = e["type"]
        type_counts[t] = type_counts.get(t, 0) + 1
    return [{"type": k, "count": v} for k, v in sorted(type_counts.items())]
