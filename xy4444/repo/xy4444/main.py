from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from config import settings
from database import init_db
from routers import (
    flight_router,
    deice_router,
    weather_router,
    gate_router,
    release_router,
    export_router
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="机场地勤寒潮航班放行系统 - 导入航班计划、除冰液记录、气象数据、机位日志，计算保持时间、浓度偏差、二次除冰和机位冲突风险，支持复核、改判、导出交接单和审计包",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(flight_router)
app.include_router(deice_router)
app.include_router(weather_router)
app.include_router(gate_router)
app.include_router(release_router)
app.include_router(export_router)


@app.get("/")
def root():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "docs": "/docs",
        "redoc": "/redoc"
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "timestamp": "2026-05-05T00:00:00"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
