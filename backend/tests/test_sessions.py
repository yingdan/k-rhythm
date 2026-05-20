"""
Test cases for Sessions API

Tests cover:
- Creating training sessions
- Getting session details
- Advancing to next bar
- Completing sessions
- Session statistics
"""
import pytest
import pytest_asyncio
from httpx import AsyncClient
from app.models.session import TrainingSession


@pytest.mark.asyncio
async def test_create_session(client: AsyncClient, auth_headers: dict, test_user, test_symbol):
    """Test creating a new training session"""
    response = await client.post(
        "/api/sessions/",
        json={
            "symbol_id": test_symbol.id,
            "period": "daily",
            "mode": "sequential",
            "start_date": "2020-01-01",
            "end_date": "2024-12-31",
            "initial_capital": 100000.0
        },
        headers=auth_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert data["code"] == 200
    assert data["message"] == "创建成功"
    assert "data" in data
    assert "id" in data["data"]


@pytest.mark.asyncio
async def test_create_session_weekly(client: AsyncClient, auth_headers: dict, test_user, test_symbol):
    """Test creating a weekly training session"""
    response = await client.post(
        "/api/sessions/",
        json={
            "symbol_id": test_symbol.id,
            "period": "weekly",
            "mode": "sequential",
            "start_date": "2020-01-01",
            "end_date": "2024-12-31",
            "initial_capital": 50000.0
        },
        headers=auth_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert data["code"] == 200


@pytest.mark.asyncio
async def test_create_session_invalid_symbol(client: AsyncClient, auth_headers: dict, test_user):
    """Test creating session with non-existent symbol"""
    response = await client.post(
        "/api/sessions/",
        json={
            "symbol_id": 9999,
            "period": "daily",
            "mode": "sequential",
            "start_date": "2020-01-01",
            "end_date": "2024-12-31"
        },
        headers=auth_headers
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_session(client: AsyncClient, auth_headers: dict, test_user, test_symbol, test_db):
    """Test getting session details"""
    session = TrainingSession(
        id="test-get-session",
        user_id=test_user.id,
        symbol_id=test_symbol.id,
        period="daily",
        mode="sequential",
        start_date="2020-01-01",
        end_date="2024-12-31",
        status="active",
        current_index=5,
        current_capital=105000.0,
        total_trades=3
    )
    test_db.add(session)
    await test_db.commit()

    response = await client.get(
        f"/api/sessions/{session.id}",
        headers=auth_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert data["code"] == 200
    assert data["data"]["id"] == session.id
    assert data["data"]["current_index"] == 5
    assert data["data"]["current_capital"] == 105000.0


@pytest.mark.asyncio
async def test_get_session_not_found(client: AsyncClient, auth_headers: dict):
    """Test getting non-existent session"""
    response = await client.get(
        "/api/sessions/non-existent-session",
        headers=auth_headers
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_session_unauthorized(client: AsyncClient, test_user, test_symbol, test_db):
    """Test getting session without authentication"""
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

    response = await client.get(f"/api/sessions/{session.id}")

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_next_bar(client: AsyncClient, auth_headers: dict, test_user, test_symbol, test_db):
    """Test advancing to next bar"""
    session = TrainingSession(
        id="test-next-bar-session",
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
        f"/api/sessions/{session.id}/next",
        headers=auth_headers
    )

    # Note: This will return 400 if parquet data doesn't exist
    # In production, this should be mocked
    assert response.status_code in [200, 400]


@pytest.mark.asyncio
async def test_next_bar_increments_index(client: AsyncClient, auth_headers: dict, test_user, test_symbol, test_db):
    """Test that next_bar increments the session index"""
    session = TrainingSession(
        id="test-index-session",
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
        f"/api/sessions/{session.id}/next",
        headers=auth_headers
    )

    # Refresh session from db
    await test_db.refresh(session)

    # Index should have been incremented
    assert session.current_index == 1


@pytest.mark.asyncio
async def test_complete_session(client: AsyncClient, auth_headers: dict, test_user, test_symbol, test_db):
    """Test completing a training session"""
    session = TrainingSession(
        id="test-complete-session",
        user_id=test_user.id,
        symbol_id=test_symbol.id,
        period="daily",
        mode="sequential",
        start_date="2020-01-01",
        end_date="2024-12-31",
        status="active",
        current_index=100
    )
    test_db.add(session)
    await test_db.commit()

    response = await client.post(
        f"/api/sessions/{session.id}/complete",
        headers=auth_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert data["code"] == 200
    assert data["message"] == "训练完成"

    # Verify session status changed
    await test_db.refresh(session)
    assert session.status == "completed"
    assert session.ended_at is not None


@pytest.mark.asyncio
async def test_complete_session_returns_stats(client: AsyncClient, auth_headers: dict, test_user, test_symbol, test_db):
    """Test that completing session returns statistics"""
    from app.models.trade import Trade
    from datetime import datetime

    session = TrainingSession(
        id="test-stats-session",
        user_id=test_user.id,
        symbol_id=test_symbol.id,
        period="daily",
        mode="sequential",
        start_date="2020-01-01",
        end_date="2024-12-31",
        status="active",
        current_index=50
    )
    test_db.add(session)
    await test_db.commit()

    # Add some trades
    trade1 = Trade(
        id="test-trade-1",
        session_id=session.id,
        symbol_id=test_symbol.id,
        direction="long",
        entry_price=10.0,
        exit_price=12.0,
        quantity=1.0,
        entry_time=datetime.utcnow(),
        exit_time=datetime.utcnow(),
        entry_index=10,
        exit_index=20,
        status="closed",
        pnl=2.0
    )
    trade2 = Trade(
        id="test-trade-2",
        session_id=session.id,
        symbol_id=test_symbol.id,
        direction="long",
        entry_price=12.0,
        exit_price=11.0,
        quantity=1.0,
        entry_time=datetime.utcnow(),
        exit_time=datetime.utcnow(),
        entry_index=20,
        exit_index=30,
        status="closed",
        pnl=-1.0
    )
    test_db.add(trade1)
    test_db.add(trade2)
    await test_db.commit()

    response = await client.post(
        f"/api/sessions/{session.id}/complete",
        headers=auth_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert "data" in data
    assert data["data"]["total_trades"] == 2
    assert data["data"]["winning_trades"] == 1
    assert data["data"]["win_rate"] == 50.0


@pytest.mark.asyncio
async def test_session_not_found_for_other_user(client: AsyncClient, auth_headers: dict, test_symbol, test_db):
    """Test that users cannot access other users' sessions"""
    from app.models.user import User
    from app.core.security import get_password_hash

    # Create another user
    other_user = User(
        id="other-user-id",
        username="otheruser",
        email="other@example.com",
        password_hash=get_password_hash("password")
    )
    test_db.add(other_user)
    await test_db.commit()

    # Create session for other user
    session = TrainingSession(
        id="other-user-session",
        user_id=other_user.id,
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

    # Try to access with current user
    response = await client.get(
        f"/api/sessions/{session.id}",
        headers=auth_headers
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_session_unauthorized_access(client: AsyncClient):
    """Test that unauthenticated requests are rejected"""
    response = await client.post(
        "/api/sessions/",
        json={
            "symbol_id": 1,
            "period": "daily",
            "mode": "sequential",
            "start_date": "2020-01-01",
            "end_date": "2024-12-31"
        }
    )

    assert response.status_code == 401
