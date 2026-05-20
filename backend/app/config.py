from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    # App
    APP_NAME: str = "KTrainer API"
    DEBUG: bool = False
    API_PREFIX: str = "/api"
    
    # Database (SQLite for local dev, PostgreSQL for production)
    DATABASE_URL: str = "sqlite+aiosqlite:///./ktrainer.db"
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # JWT
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Data paths
    PARQUET_DIR: str = "./data/parquet"
    
    class Config:
        env_file = ".env"

@lru_cache
def get_settings():
    return Settings()
