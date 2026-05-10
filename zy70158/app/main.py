"""API 密钥配额服务主入口"""
from fastapi import FastAPI
from contextlib import asynccontextmanager

from app.config import settings
from app.database import init_db
from app.routers import keys, reports


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    init_db()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    description="API 密钥配额服务 - 专注于开放平台 API 密钥的配额、IP 规则和封禁管理",
    version="1.0.0",
    lifespan=lifespan
)

app.include_router(keys.router, prefix=settings.API_PREFIX)
app.include_router(reports.router, prefix=settings.API_PREFIX)


@app.get("/health")
def health_check():
    """健康检查"""
    return {"status": "healthy", "service": settings.APP_NAME}


@app.get("/")
def root():
    """根路径信息"""
    return {
        "service": settings.APP_NAME,
        "version": "1.0.0",
        "docs": "/docs",
        "api_prefix": settings.API_PREFIX
    }
