from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import settings
from app.database import engine, Base
from app.api import (
    projects,
    interfaces,
    traffic_models,
    load_test_batches,
    machine_capacities,
    monitoring_snapshots,
    optimization_actions,
    reports,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="压测复盘后端 API 服务 - 统一管理压测项目、批次、指标和调优动作",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router, prefix="/api/v1")
app.include_router(interfaces.router, prefix="/api/v1")
app.include_router(traffic_models.router, prefix="/api/v1")
app.include_router(load_test_batches.router, prefix="/api/v1")
app.include_router(machine_capacities.router, prefix="/api/v1")
app.include_router(monitoring_snapshots.router, prefix="/api/v1")
app.include_router(optimization_actions.router, prefix="/api/v1")
app.include_router(reports.router, prefix="/api/v1")


@app.get("/")
def root():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "docs": "/docs",
        "redoc": "/redoc",
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}
