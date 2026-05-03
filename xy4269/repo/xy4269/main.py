from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from datetime import datetime

from app.config import settings
from app.database import init_db
from app.routers import (
    import_router,
    check_router,
    approval_router,
    query_export_router
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] 正在初始化数据库...")
    init_db()
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] 数据库初始化完成")
    yield
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] 应用正在关闭...")

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="地铁运营公司夜间检修调度封锁点冲突审签台 - 后端 API 服务",
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

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """全局异常处理"""
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "message": f"服务器内部错误: {str(exc)}",
            "detail": str(exc) if settings.DEBUG else None
        }
    )

app.include_router(import_router.router, prefix="/api")
app.include_router(check_router.router, prefix="/api")
app.include_router(approval_router.router, prefix="/api")
app.include_router(query_export_router.router, prefix="/api")

@app.get("/")
async def root():
    """根路由 - 系统健康检查"""
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "timestamp": datetime.now().isoformat(),
        "docs": {
            "swagger": "/docs",
            "redoc": "/redoc",
            "openapi": "/openapi.json"
        }
    }

@app.get("/health")
async def health_check():
    """健康检查端点"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "service": settings.APP_NAME
    }

@app.get("/api/status")
async def get_system_status():
    """获取系统状态"""
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "debug_mode": settings.DEBUG,
        "database": "connected",
        "upload_dir": settings.UPLOAD_DIR,
        "export_dir": settings.EXPORT_DIR,
        "timestamp": datetime.now().isoformat()
    }

if __name__ == "__main__":
    import uvicorn
    print(f"启动 {settings.APP_NAME} v{settings.APP_VERSION}")
    print(f"访问地址: http://localhost:8000")
    print(f"API 文档: http://localhost:8000/docs")
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG
    )
