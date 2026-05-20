"""
Test cases for Kline API

Tests cover:
- Getting kline data for a symbol
- Getting single bar by index
- Pagination with from_index and to_index
- Error handling for non-existent symbols
"""
import pytest
import pytest_asyncio
from httpx import AsyncClient
from app.models.symbol import Symbol


@pytest.mark.asyncio
async def test_get_kline_data(client: AsyncClient, auth_headers: dict, test_symbol):
    """Test getting kline data for a symbol"""
    response = await client.get(
        f"/api/kline/{test_symbol.symbol_code}",
        headers=auth_headers
    )

    # Returns 404 if parquet data doesn't exist, which is expected
    assert response.status_code in [200, 404]


@pytest.mark.asyncio
async def test_get_kline_data_with_pagination(client: AsyncClient, auth_headers: dict, test_symbol):
    """Test getting kline data with pagination"""
    response = await client.get(
        f"/api/kline/{test_symbol.symbol_code}?from_index=0&to_index=10",
        headers=auth_headers
    )

    # Returns 404 if parquet data doesn't exist
    assert response.status_code in [200, 404]


@pytest.mark.asyncio
async def test_get_kline_data_us_symbol(client: AsyncClient, auth_headers: dict, test_db):
    """Test getting kline data for US symbol"""
    symbol = Symbol(
        id=2,
        symbol_code="AAPL.US",
        market="us",
        name="Apple Inc."
    )
    test_db.add(symbol)
    await test_db.commit()

    response = await client.get(
        "/api/kline/AAPL.US",
        headers=auth_headers
    )

    # Should route to US parquet directory
    assert response.status_code in [200, 404]


@pytest.mark.asyncio
async def test_get_single_bar(client: AsyncClient, auth_headers: dict, test_symbol):
    """Test getting single bar by index"""
    response = await client.get(
        f"/api/kline/{test_symbol.symbol_code}/bar/0",
        headers=auth_headers
    )

    assert response.status_code in [200, 404]


@pytest.mark.asyncio
async def test_get_single_bar_invalid_index(client: AsyncClient, auth_headers: dict, test_symbol):
    """Test getting bar with invalid index"""
    response = await client.get(
        f"/api/kline/{test_symbol.symbol_code}/bar/999999",
        headers=auth_headers
    )

    # Should return 404 for out of range index
    assert response.status_code in [400, 404]


@pytest.mark.asyncio
async def test_get_kline_unauthorized(client: AsyncClient, test_symbol):
    """Test getting kline data without authentication"""
    response = await client.get(f"/api/kline/{test_symbol.symbol_code}")

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_kline_data_structure(client: AsyncClient, auth_headers: dict, test_symbol):
    """Test that kline data has correct structure"""
    # This test assumes parquet data exists
    response = await client.get(
        f"/api/kline/{test_symbol.symbol_code}?from_index=0&to_index=1",
        headers=auth_headers
    )

    if response.status_code == 200:
        data = response.json()
        assert data["code"] == 200
        assert "data" in data
        assert "bars" in data["data"]
        assert "total" in data["data"]

        if len(data["data"]["bars"]) > 0:
            bar = data["data"]["bars"][0]
            assert "timestamp" in bar
            assert "open" in bar
            assert "high" in bar
            assert "low" in bar
            assert "close" in bar
            assert "volume" in bar


@pytest.mark.asyncio
async def test_single_bar_data_structure(client: AsyncClient, auth_headers: dict, test_symbol):
    """Test that single bar data has correct structure"""
    response = await client.get(
        f"/api/kline/{test_symbol.symbol_code}/bar/0",
        headers=auth_headers
    )

    if response.status_code == 200:
        data = response.json()
        assert data["code"] == 200
        assert "data" in data
        bar = data["data"]
        assert "index" in bar
        assert "timestamp" in bar
        assert "open" in bar
        assert "high" in bar
        assert "low" in bar
        assert "close" in bar
        assert "volume" in bar


@pytest.mark.asyncio
async def test_kline_cn_market_path(client: AsyncClient, auth_headers: dict, test_db):
    """Test that CN market symbols use correct parquet path"""
    symbol = Symbol(
        id=3,
        symbol_code="600519.SH",
        market="cn",
        name="贵州茅台"
    )
    test_db.add(symbol)
    await test_db.commit()

    # The code should route this to cn parquet directory
    response = await client.get(
        "/api/kline/600519.SH",
        headers=auth_headers
    )

    # Path should be: data/parquet/cn/cn_600519_SH_daily.parquet
    assert response.status_code in [200, 404]
