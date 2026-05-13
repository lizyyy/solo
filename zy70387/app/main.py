from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.models import Base, engine
from app.api import api_router

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="任务日志采样 API",
    description="""
    任务日志采样系统 API，支持：
    - 写入任务日志（带采样决策）
    - 配置采样规则（按任务类型和租户）
    - 失败日志全量保留 + 上下文窗口
    - VIP 租户高采样率
    - 过期日志清理
    - 统计报告查询
    """,
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="")


@app.get("/", tags=["健康检查"])
def health_check():
    return {
        "status": "healthy",
        "service": "task-log-sampling-api",
        "version": "1.0.0"
    }


@app.get("/health", tags=["健康检查"])
def health():
    return {"status": "ok"}
