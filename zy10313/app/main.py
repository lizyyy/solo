from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager

from app.models.database import engine, Base
from app.api.batches import router as batches_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(
    title="Async Import Rollback Service",
    description="统一异步导入回滚服务 - 管理批次导入、阶段追踪、数据写入明细和回滚执行",
    version="1.0.0",
    lifespan=lifespan
)

app.include_router(batches_router, prefix="/api/v1")


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    if isinstance(exc.detail, dict):
        return JSONResponse(
            status_code=exc.status_code,
            content=exc.detail
        )
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "code": "UNKNOWN_ERROR",
            "message": str(exc.detail)
        }
    )


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "async-import-rollback"}
