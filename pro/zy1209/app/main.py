from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from .config import settings, ensure_directories
from .database import init_db
from .routers import tasks, analysis, exports, comparisons
from .exceptions import AppException


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_directories()
    init_db()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="数据库性能诊断 API 服务 - 提供连接池容量、批量写入收益、索引缺失/冗余、慢SQL、读写分离路由、分库分表热点等诊断分析",
    lifespan=lifespan
)


app.include_router(tasks.router, prefix="/api/v1/tasks", tags=["tasks"])
app.include_router(analysis.router, prefix="/api/v1/analysis", tags=["analysis"])
app.include_router(exports.router, prefix="/api/v1/exports", tags=["exports"])
app.include_router(comparisons.router, prefix="/api/v1/comparisons", tags=["comparisons"])


@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error_code": exc.error_code,
            "error_message": exc.error_message,
            "details": exc.details,
            "timestamp": exc.timestamp.isoformat()
        }
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "error_code": "VALIDATION_ERROR",
            "error_message": "请求参数验证失败",
            "details": exc.errors(),
            "timestamp": exc.body.get("timestamp", None) if exc.body else None
        }
    )


@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": settings.APP_VERSION}


@app.get("/")
async def root():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "redoc": "/redoc"
    }
