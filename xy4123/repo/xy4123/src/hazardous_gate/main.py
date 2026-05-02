from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.exception_handlers import RequestValidationError

from hazardous_gate.config import get_settings
from hazardous_gate.routers import (
    audit_router,
    batches_router,
    import_export_router,
    reagents_router,
    usages_router,
)
from hazardous_gate.storage.database import init_db

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="学校化学实验室危化品领用管理API系统 - 危化品领用闸门",
    lifespan=lifespan,
    contact={
        "name": "实验室管理员",
        "description": "化学实验室危化品管理系统",
    },
    license_info={
        "name": "内部使用",
    },
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": {
                "message": "请求参数校验失败",
                "errors": exc.errors(),
            }
        },
    )


@app.get("/", tags=["系统"])
async def root():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "docs": "/docs",
        "openapi": "/openapi.json",
    }


@app.get("/health", tags=["系统"])
async def health_check():
    return {
        "status": "healthy",
        "timestamp": __import__('datetime').datetime.now().isoformat(),
    }


@app.get("/api/info", tags=["系统"])
async def api_info():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "features": [
            "试剂管理",
            "批次库存管理",
            "课程领用管理",
            "归还/废弃管理",
            "规则引擎校验",
            "CSV导入导出",
            "Markdown追溯报告",
            "审计日志",
        ],
        "validation_rules": [
            "CAS号格式校验",
            "浓度单位校验",
            "有效期校验",
            "储柜分类校验",
            "重复批号检测",
            "超量领用拦截",
            "过期试剂拦截",
            "危化等级授权校验",
            "互斥试剂同车检测",
            "废液去向校验",
        ],
    }


app.include_router(reagents_router, prefix="/api/v1")
app.include_router(batches_router, prefix="/api/v1")
app.include_router(usages_router, prefix="/api/v1")
app.include_router(import_export_router, prefix="/api/v1")
app.include_router(audit_router, prefix="/api/v1")
