from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.database import init_db
from app.routers.import_router import router as import_router
from app.routers.settlement_router import router as settlement_router
from app.routers.anomaly_router import router as anomaly_router
from app.routers.export_router import router as export_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="农机跨村作业结算复核服务",
    description="合作社农机跨村作业结算复核系统，支持GPS轨迹分析、面积核算、异常检测和数据导出",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(import_router.router, prefix="/api/v1")
app.include_router(settlement_router.router, prefix="/api/v1")
app.include_router(anomaly_router.router, prefix="/api/v1")
app.include_router(export_router.router, prefix="/api/v1")


@app.get("/")
async def root():
    return {
        "name": "农机跨村作业结算复核服务",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
        "redoc": "/redoc"
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
