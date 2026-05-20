import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.main import app
from app.database import Base, get_db
from app.models.user import User
from app.models.symbol import Symbol
from app.core.security import get_password_hash

# Test database URL (SQLite for testing)
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

@pytest_asyncio.fixture
async def test_engine():
    """Create test database engine"""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()

@pytest_asyncio.fixture
async def test_db(test_engine):
    """Create test database session"""
    async_session = async_sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with async_session() as session:
        yield session

@pytest_asyncio.fixture
async def client(test_db):
    """Create test client with database override"""
    async def override_get_db():
        yield test_db

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()

@pytest_asyncio.fixture
async def test_user(test_db):
    """Create test user"""
    user = User(
        id="test-user-id",
        username="testuser",
        email="test@example.com",
        password_hash=get_password_hash("testpassword123")
    )
    test_db.add(user)
    await test_db.commit()
    await test_db.refresh(user)
    return user

@pytest_asyncio.fixture
async def test_symbol(test_db):
    """Create test symbol"""
    symbol = Symbol(
        id=1,
        symbol_code="600000.SH",
        market="cn",
        name="浦发银行"
    )
    test_db.add(symbol)
    await test_db.commit()
    await test_db.refresh(symbol)
    return symbol

@pytest_asyncio.fixture
async def auth_headers(test_user):
    """Get authentication headers"""
    from app.core.security import create_access_token
    token = create_access_token(data={"sub": test_user.id})
    return {"Authorization": f"Bearer {token}"}
