from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.api import auth, kline, sessions, trades, statistics, us_events

settings = get_settings()

app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(auth.router, prefix=settings.API_PREFIX)
app.include_router(kline.router, prefix=settings.API_PREFIX)
app.include_router(sessions.router, prefix=settings.API_PREFIX)
app.include_router(trades.router, prefix=settings.API_PREFIX)
app.include_router(statistics.router, prefix=settings.API_PREFIX)
app.include_router(us_events.router, prefix=settings.API_PREFIX)

@app.get("/")
async def root():
    return {"message": "KTrainer API", "version": "1.0.0"}

@app.get("/health")
async def health():
    return {"status": "healthy"}
