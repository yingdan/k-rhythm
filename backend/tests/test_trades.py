"""
Test cases for Trades API

Tests cover:
- Opening positions (long/short)
- Closing positions
- Position management
"""
import pytest
import pytest_asyncio
from httpx import AsyncClient
from app.models.trade import Trade
from app.models.session import TrainingSession


@pytest.mark.asyncio
async def test_open_long_position(client: AsyncClient, auth_headers: dict, test_user, test_symbol, test_db):
    """Test opening a long position"""
    # Create a training session first
    session = TrainingSession(
        id="test-session-id",
        user_id=test_user.id,
        symbol_id=test_symbol.id,
        period="daily",
        mode="sequential",
        start_date="2020-01-01",
        end_date="2024-12-31",
        status="active",
        current_index=0
    )
    test_db.add(session)
    await test_db.commit()

    # Open a long position
    response = await client.post(
        "/api/trades/",
        json={
            "session_id": session.id,
            "direction": "long",
            "quantity": 1.0,
            "stop_loss": None,
            "take_profit": None
        },
        headers=auth_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert data["code"] == 200
    assert data["message"] == "开仓成功"
    assert "data" in data
    assert "id" in data["data"]
    assert data["data"]["entry_price"] > 0


@pytest.mark.asyncio
async def test_open_short_position(client: AsyncClient, auth_headers: dict, test_user, test_symbol, test_db):
    """Test opening a short position"""
    session = TrainingSession(
        id="test-session-short",
        user_id=test_user.id,
        symbol_id=test_symbol.id,
        period="daily",
        mode="sequential",
        start_date="2020-01-01",
        end_date="2024-12-31",
        status="active",
        current_index=0
    )
    test_db.add(session)
    await test_db.commit()

    response = await client.post(
        "/api/trades/",
        json={
            "session_id": session.id,
            "direction": "short",
            "quantity": 1.0
        },
        headers=auth_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert data["code"] == 200
    assert data["message"] == "开仓成功"


@pytest.mark.asyncio
async def test_open_position_with_sl_tp(client: AsyncClient, auth_headers: dict, test_user, test_symbol, test_db):
    """Test opening a position with stop loss and take profit"""
    session = TrainingSession(
        id="test-session-sltp",
        user_id=test_user.id,
        symbol_id=test_symbol.id,
        period="daily",
        mode="sequential",
        start_date="2020-01-01",
        end_date="2024-12-31",
        status="active",
        current_index=0
    )
    test_db.add(session)
    await test_db.commit()

    response = await client.post(
        "/api/trades/",
        json={
            "session_id": session.id,
            "direction": "long",
            "quantity": 1.0,
            "stop_loss": 9.5,
            "take_profit": 11.5
        },
        headers=auth_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert data["code"] == 200


@pytest.mark.asyncio
async def test_close_position(client: AsyncClient, auth_headers: dict, test_user, test_symbol, test_db):
    """Test closing a position"""
    # Create session
    session = TrainingSession(
        id="test-session-close",
        user_id=test_user.id,
        symbol_id=test_symbol.id,
        period="daily",
        mode="sequential",
        start_date="2020-01-01",
        end_date="2024-12-31",
        status="active",
        current_index=1
    )
    test_db.add(session)
    await test_db.commit()

    # Create open trade
    trade = Trade(
        id="test-trade-close",
        session_id=session.id,
        symbol_id=test_symbol.id,
        direction="long",
        entry_price=10.0,
        quantity=1.0,
        entry_time=test_db.bind.pool._origin.connect().execute.__self__.__class__,
        entry_index=0,
        status="open"
    )
    # Fix: Use proper datetime
    from datetime import datetime
    trade.entry_time = datetime.utcnow()
    test_db.add(trade)
    await test_db.commit()

    # Close the position
    response = await client.post(
        f"/api/trades/{trade.id}/close",
        json={"exit_price": 11.0},
        headers=auth_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert data["code"] == 200
    assert data["message"] == "平仓成功"
    assert "pnl" in data["data"]
    assert data["data"]["pnl"] > 0  # Should have profit for long position


@pytest.mark.asyncio
async def test_get_active_positions(client: AsyncClient, auth_headers: dict, test_user, test_symbol, test_db):
    """Test getting active positions"""
    session = TrainingSession(
        id="test-session-active",
        user_id=test_user.id,
        symbol_id=test_symbol.id,
        period="daily",
        mode="sequential",
        start_date="2020-01-01",
        end_date="2024-12-31",
        status="active",
        current_index=0
    )
    test_db.add(session)
    await test_db.commit()

    # Create open trade
    from datetime import datetime
    trade = Trade(
        id="test-trade-active",
        session_id=session.id,
        symbol_id=test_symbol.id,
        direction="long",
        entry_price=10.0,
        quantity=1.0,
        entry_time=datetime.utcnow(),
        entry_index=0,
        status="open"
    )
    test_db.add(trade)
    await test_db.commit()

    response = await client.get(
        f"/api/trades/active?session_id={session.id}",
        headers=auth_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert data["code"] == 200
    assert "positions" in data["data"]
    assert len(data["data"]["positions"]) == 1


@pytest.mark.asyncio
async def test_open_position_unauthorized(client: AsyncClient):
    """Test opening position without authentication"""
    response = await client.post(
        "/api/trades/",
        json={
            "session_id": "test-session",
            "direction": "long",
            "quantity": 1.0
        }
    )

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_open_position_invalid_session(client: AsyncClient, auth_headers: dict, test_user, test_db):
    """Test opening position with non-existent session"""
    response = await client.post(
        "/api/trades/",
        json={
            "session_id": "non-existent-session",
            "direction": "long",
            "quantity": 1.0
        },
        headers=auth_headers
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_close_position_unauthorized(client: AsyncClient, test_user, test_symbol, test_db):
    """Test closing position without authentication"""
    from datetime import datetime
    session = TrainingSession(
        id="test-session-noauth",
        user_id=test_user.id,
        symbol_id=test_symbol.id,
        period="daily",
        mode="sequential",
        start_date="2020-01-01",
        end_date="2024-12-31",
        status="active",
        current_index=0
    )
    test_db.add(session)
    await test_db.commit()

    trade = Trade(
        id="test-trade-noauth",
        session_id=session.id,
        symbol_id=test_symbol.id,
        direction="long",
        entry_price=10.0,
        quantity=1.0,
        entry_time=datetime.utcnow(),
        entry_index=0,
        status="open"
    )
    test_db.add(trade)
    await test_db.commit()

    response = await client.post(
        f"/api/trades/{trade.id}/close",
        json={"exit_price": 11.0}
    )

    assert response.status_code == 401
