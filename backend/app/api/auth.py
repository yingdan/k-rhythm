from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
from datetime import timedelta

from app.database import get_db
from app.models.user import User
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    get_current_user
)

router = APIRouter(prefix="/auth", tags=["认证"])

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class UserResponse(BaseModel):
    id: str
    username: str
    email: str

@router.post("/register", response_model=dict)
async def register(user: UserCreate, db: AsyncSession = Depends(get_db)):
    # 检查用户名
    result = await db.execute(select(User).where(User.username == user.username))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="用户名已存在")
    
    # 检查邮箱
    result = await db.execute(select(User).where(User.email == user.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="邮箱已注册")
    
    # 创建用户
    from app.core.security import get_password_hash
    new_user = User(
        username=user.username,
        email=user.email,
        password_hash=get_password_hash(user.password)
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    
    return {"code": 200, "message": "注册成功", "data": {"id": new_user.id, "username": new_user.username}}

@router.post("/login", response_model=dict)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == form_data.username))
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    
    access_token = create_access_token(data={"sub": user.id})
    refresh_token = create_refresh_token(data={"sub": user.id})
    
    return {
        "code": 200,
        "message": "登录成功",
        "data": {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer"
        }
    }

@router.get("/me", response_model=dict)
async def get_me(current_user: User = Depends(get_current_user)):
    return {
        "code": 200,
        "message": "success",
        "data": {
            "id": current_user.id,
            "username": current_user.username,
            "email": current_user.email
        }
    }
