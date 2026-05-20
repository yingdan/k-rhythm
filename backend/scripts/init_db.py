"""
初始化数据库脚本
创建所有表
"""
import asyncio
from app.database import engine, Base
from app.models import User, Symbol, TrainingSession, Trade

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("数据库表创建成功！")

if __name__ == "__main__":
    asyncio.run(init_db())
