from fastapi import FastAPI
from contextlib import asynccontextmanager

from app.models.database import init_db
from app.api.batches import router as batches_router
from app.api.work_orders import router as work_orders_router
from app.api.exports import router as exports_router
from app.api.tasks import router as tasks_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="充电桩巡检异常回执状态机 API",
    description="""
    充电桩巡检异常回执状态机服务，支持：
    - 多源数据接入：桩端告警、巡检表、客服投诉单、临时补录单
    - 工单状态流转管理
    - 批次创建与导入（支持忽略、覆盖、追加策略）
    - 复核改判、冻结结算、撤回归档
    - 审计日志追踪
    - 异步任务处理（重试、人工介入、永久失败）
    - 片区经理汇总报表导出
    """,
    version="1.0.0",
    lifespan=lifespan,
)


app.include_router(batches_router, prefix="/api/v1")
app.include_router(work_orders_router, prefix="/api/v1")
app.include_router(exports_router, prefix="/api/v1")
app.include_router(tasks_router, prefix="/api/v1")


@app.get("/")
def root():
    return {
        "name": "充电桩巡检异常回执状态机 API",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}


def run_cli():
    from app.cli import main
    main()


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] != "api":
        run_cli()
    else:
        import uvicorn
        from app.config import settings

        uvicorn.run(
            "app.main:app",
            host=settings.API_HOST,
            port=settings.API_PORT,
            reload=settings.DEBUG,
        )
