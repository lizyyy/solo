from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.routers import events, metrics, alerts, rankings, reports, windows


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="实时指标迟到修正服务",
    description="""
    解决实时指标遇到迟到事件后，榜单、告警和日报相互矛盾的问题。
    
    核心设计：
    - 事件时间（event_time）作为入口，而非接收时间
    - 迟到窗口定义：ingest_time - event_time > window → 迟到事件
    - 迟到事件自动触发修正流程
    - 人工修正后锁定状态，后续计算不再覆盖
    - 所有查询默认返回最新版本（is_latest=True），保证一致性
    """,
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


app.include_router(events.router)
app.include_router(metrics.router)
app.include_router(alerts.router)
app.include_router(rankings.router)
app.include_router(reports.router)
app.include_router(windows.router)


@app.get("/")
async def root():
    return {
        "service": "实时指标迟到修正服务",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": {
            "events": "/api/events",
            "metrics": "/api/metrics",
            "alerts": "/api/alerts",
            "rankings": "/api/rankings",
            "reports": "/api/correction-reports",
            "windows": "/api/latency-windows"
        }
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}
