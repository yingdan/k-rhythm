from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from app.config import get_settings

Base = declarative_base()

# SQLite 需要 check_same_thread=False
engine_args = {"echo": False}
db_url = get_settings().DATABASE_URL
if db_url.startswith("sqlite"):
    engine_args["connect_args"] = {"check_same_thread": False}

engine = create_async_engine(db_url, **engine_args)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

async def init_db():
    """Initialize database tables"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
