from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.api.v1.temperature_events import router as temperature_events_router
from app.api.v1.dispatches import router as dispatches_router
from app.api.v1.repair_receipts import router as repair_receipts_router
from app.api.v1.escalations import router as escalations_router
from app.api.v1.parts import router as parts_router
from app.api.v1.statistics import router as statistics_router

init_db()

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="冷柜维修派单系统 API - 实现温度事件、派单路由、维修回执、超时升级、配件记录、闭环统计等功能",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(temperature_events_router, prefix="/api/v1")
app.include_router(dispatches_router, prefix="/api/v1")
app.include_router(repair_receipts_router, prefix="/api/v1")
app.include_router(escalations_router, prefix="/api/v1")
app.include_router(parts_router, prefix="/api/v1")
app.include_router(statistics_router, prefix="/api/v1")


@app.get("/", tags=["health"])
async def root():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
    }


@app.get("/health", tags=["health"])
async def health_check():
    return {"status": "healthy"}
