from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.routers.auth import router as auth_router
from app.routers.store import router as store_router, product_router, inventory_router
from app.routers.inventory import (
    router as price_change_router,
    transfer_router,
    import_export_router,
    audit_router,
    failed_task_router
)

settings = get_settings()

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="门店库存管理系统API - 支持改价、调拨、状态流转、失败重试、历史版本、导入导出"
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "code": exc.status_code,
            "message": exc.detail,
            "data": None
        }
    )


@app.exception_handler(Exception)
async def exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "code": 500,
            "message": f"服务器内部错误: {str(exc)}",
            "data": None
        }
    )


@app.get("/")
def root():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "docs": "/docs"
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}


api_prefix = "/api/v1"
app.include_router(auth_router, prefix=api_prefix)
app.include_router(store_router, prefix=api_prefix)
app.include_router(product_router, prefix=api_prefix)
app.include_router(inventory_router, prefix=api_prefix)
app.include_router(price_change_router, prefix=api_prefix)
app.include_router(transfer_router, prefix=api_prefix)
app.include_router(import_export_router, prefix=api_prefix)
app.include_router(audit_router, prefix=api_prefix)
app.include_router(failed_task_router, prefix=api_prefix)
