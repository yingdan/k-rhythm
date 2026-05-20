"""
Test cases for Authentication API

Tests cover:
- User registration
- User login
- Token validation
- Protected route access
"""
import pytest
import pytest_asyncio
from httpx import AsyncClient
from app.models.user import User


@pytest.mark.asyncio
async def test_register_user(client: AsyncClient):
    """Test user registration"""
    response = await client.post(
        "/api/auth/register",
        json={
            "username": "newuser",
            "email": "newuser@example.com",
            "password": "securepassword123"
        }
    )

    assert response.status_code == 200
    data = response.json()
    assert data["code"] == 200
    assert data["message"] == "注册成功"
    assert "data" in data
    assert data["data"]["username"] == "newuser"


@pytest.mark.asyncio
async def test_register_duplicate_username(client: AsyncClient, test_user):
    """Test registration with duplicate username"""
    response = await client.post(
        "/api/auth/register",
        json={
            "username": test_user.username,  # Already exists
            "email": "different@example.com",
            "password": "password123"
        }
    )

    assert response.status_code == 400
    data = response.json()
    assert data["detail"] == "用户名已存在"


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient, test_user):
    """Test registration with duplicate email"""
    response = await client.post(
        "/api/auth/register",
        json={
            "username": "differentuser",
            "email": test_user.email,  # Already exists
            "password": "password123"
        }
    )

    assert response.status_code == 400
    data = response.json()
    assert data["detail"] == "邮箱已注册"


@pytest.mark.asyncio
async def test_register_invalid_email(client: AsyncClient):
    """Test registration with invalid email format"""
    response = await client.post(
        "/api/auth/register",
        json={
            "username": "testuser",
            "email": "invalid-email",
            "password": "password123"
        }
    )

    assert response.status_code == 422  # Validation error


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient, test_user):
    """Test successful login"""
    response = await client.post(
        "/api/auth/login",
        data={
            "username": test_user.username,
            "password": "testpassword123"
        }
    )

    assert response.status_code == 200
    data = response.json()
    assert data["code"] == 200
    assert data["message"] == "登录成功"
    assert "data" in data
    assert "access_token" in data["data"]
    assert "refresh_token" in data["data"]
    assert data["data"]["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient, test_user):
    """Test login with wrong password"""
    response = await client.post(
        "/api/auth/login",
        data={
            "username": test_user.username,
            "password": "wrongpassword"
        }
    )

    assert response.status_code == 401
    data = response.json()
    assert data["detail"] == "用户名或密码错误"


@pytest.mark.asyncio
async def test_login_nonexistent_user(client: AsyncClient):
    """Test login with non-existent user"""
    response = await client.post(
        "/api/auth/login",
        data={
            "username": "nonexistent",
            "password": "password123"
        }
    )

    assert response.status_code == 401
    data = response.json()
    assert data["detail"] == "用户名或密码错误"


@pytest.mark.asyncio
async def test_get_me(client: AsyncClient, auth_headers: dict, test_user):
    """Test getting current user profile"""
    response = await client.get(
        "/api/auth/me",
        headers=auth_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert data["code"] == 200
    assert data["data"]["id"] == test_user.id
    assert data["data"]["username"] == test_user.username
    assert data["data"]["email"] == test_user.email


@pytest.mark.asyncio
async def test_get_me_unauthorized(client: AsyncClient):
    """Test getting profile without authentication"""
    response = await client.get("/api/auth/me")

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_me_invalid_token(client: AsyncClient):
    """Test getting profile with invalid token"""
    response = await client.get(
        "/api/auth/me",
        headers={"Authorization": "Bearer invalid-token"}
    )

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_token_contains_user_id(client: AsyncClient, test_user):
    """Test that token payload contains correct user ID"""
    response = await client.post(
        "/api/auth/login",
        data={
            "username": test_user.username,
            "password": "testpassword123"
        }
    )

    assert response.status_code == 200
    data = response.json()
    token = data["data"]["access_token"]

    # Decode token (without verification for testing)
    from jose import jwt
    from app.config import get_settings
    settings = get_settings()

    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    assert payload["sub"] == test_user.id
    assert payload["type"] == "access"
