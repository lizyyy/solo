from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import settings
from app.db.database import engine, Base
from app.routers import tasks, executions


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title=settings.app_name,
    description="""
缓存预热编排 API - 专为大促场景设计的缓存预热管理系统

**核心能力**:
- 预热任务编排: 定义数据源、缓存键格式、版本策略
- 数据版本管理: 校验和验证、重跑一致性保障
- 并发与限速: 并发数控制、QPS限流保护
- 失败隔离: 单条失败不影响整体，支持重跑
- 命中校验: 预期命中 vs 实际命中对比
- 预热报告: 完整的执行报告和操作历史
- 补录与撤回: 精细控制和安全回滚

**典型场景**: 大促前商品详情、库存、价格等热点数据的缓存预热，
确保上线时不会带着旧数据，同时具备快速回滚能力。
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

app.include_router(tasks.router)
app.include_router(executions.router)


@app.get("/", tags=["系统"])
async def root():
    return {
        "app": settings.app_name,
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
        "redoc": "/redoc"
    }


@app.get("/health", tags=["系统"])
async def health():
    return {"status": "healthy"}
