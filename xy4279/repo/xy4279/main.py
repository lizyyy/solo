import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from contextlib import asynccontextmanager

from config import init_db, get_db
from routes import (
    operation_router, import_router, compare_router,
    check_router, simulation_router, export_router, risk_router
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="定值票联锁核验台",
    description="变电站继保班定值票联锁核验后端API服务 - 支持导入、版本比对、联锁检查、模拟下发/回滚、风险查询和审计导出",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": exc.errors(),
            "body": exc.body
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": str(exc)
        }
    )


app.include_router(operation_router)
app.include_router(import_router)
app.include_router(compare_router)
app.include_router(check_router)
app.include_router(simulation_router)
app.include_router(export_router)
app.include_router(risk_router)


@app.get("/", tags=["健康检查"])
async def root():
    return {
        "name": "定值票联锁核验台",
        "version": "1.0.0",
        "status": "running",
        "description": "变电站继保班定值票联锁核验后端API服务"
    }


@app.get("/health", tags=["健康检查"])
async def health_check():
    return {
        "status": "healthy",
        "timestamp": None
    }


@app.get("/api/info", tags=["系统信息"])
async def get_system_info():
    return {
        "name": "定值票联锁核验台",
        "version": "1.0.0",
        "api_base": "/api",
        "available_routes": {
            "operations": "/api/operations",
            "import": "/api/import",
            "compare": "/api/compare",
            "check": "/api/check",
            "simulation": "/api/simulation",
            "export": "/api/export",
            "risk": "/api/risk"
        },
        "features": [
            "数据导入（Excel/CSV/JSON/YAML）",
            "版本比对",
            "联锁检查（版本一致性、压板顺序、审批完整性、拓扑联锁、定值范围）",
            "模拟下发/回滚",
            "风险查询",
            "审计导出（Markdown/CSV/JSON）"
        ]
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
