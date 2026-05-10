from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.database import init_db, close_db
from app.routers import (
    race_router,
    result_router,
    chip_router,
    appeal_router,
    review_router,
    exception_router,
    recalculation_router,
    export_router,
    task_router,
)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    await init_db()
    yield
    await close_db()


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="赛事成绩申诉系统 - 管理成绩版本、芯片数据、申诉任务、裁判复核、名次重算和公示导出",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(race_router)
app.include_router(result_router)
app.include_router(chip_router)
app.include_router(appeal_router)
app.include_router(review_router)
app.include_router(exception_router)
app.include_router(recalculation_router)
app.include_router(export_router)
app.include_router(task_router)


@app.get("/health")
async def health_check():
    """健康检查"""
    return {
        "status": "healthy",
        "app_name": settings.app_name,
        "version": settings.app_version,
    }


@app.get("/")
async def root():
    """根路径信息"""
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "docs": "/docs",
        "health": "/health",
    }
