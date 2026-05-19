from fastapi import FastAPI
from contextlib import asynccontextmanager

from app.core.database import engine, Base
from app.api import (
    tools_router,
    permissions_router,
    calls_router,
    approvals_router,
    exceptions_router,
    audit_router,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="MCP工具权限声明API",
    description="MCP工具权限声明与实际调用比对后端服务，支持审批批次管理、异常复核、审计摘要导出",
    version="1.0.0",
    lifespan=lifespan,
)

app.include_router(tools_router, prefix="/api/v1")
app.include_router(permissions_router, prefix="/api/v1")
app.include_router(calls_router, prefix="/api/v1")
app.include_router(approvals_router, prefix="/api/v1")
app.include_router(exceptions_router, prefix="/api/v1")
app.include_router(audit_router, prefix="/api/v1")


@app.get("/")
async def root():
    return {
        "message": "MCP工具权限声明API",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
