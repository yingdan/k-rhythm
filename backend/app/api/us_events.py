from fastapi import APIRouter, Query
from typing import Optional
from app.services.us_event_service import (
    get_events_for_symbol,
    get_macro_events,
    get_events_in_range,
    get_event_types,
)

router = APIRouter(prefix="/us-events", tags=["美股事件"])


@router.get("/types", response_model=dict)
async def event_types():
    """Get available event types and their counts."""
    types = get_event_types()
    return {"code": 200, "message": "success", "data": {"types": types}}


@router.get("/macro", response_model=dict)
async def macro_events():
    """Get all macroeconomic and Fed events."""
    events = get_macro_events()
    return {
        "code": 200,
        "message": "success",
        "data": {"events": events, "total": len(events)},
    }


@router.get("/{symbol}", response_model=dict)
async def stock_events(symbol: str):
    """Get events for a specific stock (e.g., AAPL, MSFT)."""
    events = get_events_for_symbol(symbol)
    return {
        "code": 200,
        "message": "success",
        "data": {"symbol": symbol.upper(), "events": events, "total": len(events)},
    }


@router.get("/range", response_model=dict)
async def events_in_range(
    start: str = Query(..., description="Start date YYYY-MM-DD"),
    end: str = Query(..., description="End date YYYY-MM-DD"),
    symbol: Optional[str] = Query(None, description="Optional stock symbol filter"),
):
    """Get events within a date range, optionally filtered by symbol."""
    events = get_events_in_range(start, end, symbol)
    return {
        "code": 200,
        "message": "success",
        "data": {"events": events, "total": len(events), "start": start, "end": end},
    }
