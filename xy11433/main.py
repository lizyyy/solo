from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
from loguru import logger
from app.config import settings
from app.database import engine, Base, SessionLocal
from app.models import *
from app.api import (
    records_router,
    imports_router,
    replay_router,
    tasks_router,
    exports_router
)
from app.services import TaskService


def setup_directories():
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    os.makedirs(settings.EXPORT_DIR, exist_ok=True)
    os.makedirs(settings.LOG_DIR, exist_ok=True)


def setup_database():
    Base.metadata.create_all(bind=engine)


def recover_pending_tasks():
    db = SessionLocal()
    try:
        task_service = TaskService(db)
        result = task_service.recover_tasks_on_startup()
        if result["total_recovered"] > 0:
            logger.info(f"服务启动: 恢复了 {result['total_recovered']} 个待处理任务")
    except Exception as e:
        logger.error(f"恢复任务失败: {str(e)}")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_directories()
    setup_database()
    recover_pending_tasks()
    logger.info(f"{settings.APP_NAME} 启动成功")
    yield
    logger.info(f"{settings.APP_NAME} 关闭")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="学校实验室耗材验收回放链路服务 API",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f"请求: {request.method} {request.url}")
    response = await call_next(request)
    logger.info(f"响应: {response.status_code}")
    return response


@app.get("/", tags=["系统"])
async def root():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "docs": "/docs"
    }


@app.get("/health", tags=["系统"])
async def health_check():
    return {"status": "healthy"}


app.include_router(records_router, prefix="/api/v1")
app.include_router(imports_router, prefix="/api/v1")
app.include_router(replay_router, prefix="/api/v1")
app.include_router(tasks_router, prefix="/api/v1")
app.include_router(exports_router, prefix="/api/v1")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
