from fastapi import FastAPI
from contextlib import asynccontextmanager

from app.core.database import init_db
from app.core.config import settings
from app.routers import (
    batteries_router,
    imports_router,
    release_check_router,
    quarantine_router,
    history_router,
    config_router
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="小型无人机测绘队电池包放行管理系统 - 后端API服务",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

app.include_router(batteries_router)
app.include_router(imports_router)
app.include_router(release_check_router)
app.include_router(quarantine_router)
app.include_router(history_router)
app.include_router(config_router)


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
        "timestamp": __import__('datetime').datetime.utcnow().isoformat()
    }
