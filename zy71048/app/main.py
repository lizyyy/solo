from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import engine, Base
from app.api.routes import router as api_router
from app.exceptions import BlastNoticeException

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="采石场爆破通知管理 API - 支持批次提交、异常拆分、复核修改、结案归档、结果导出",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(BlastNoticeException)
async def blast_notice_exception_handler(request: Request, exc: BlastNoticeException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "code": exc.status_code,
            "message": exc.message,
            "error_code": exc.error_code.value if exc.error_code else None,
            "error_details": exc.error_details,
            "path": request.url.path,
        },
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "code": 500,
            "message": "服务器内部错误",
            "error_code": "INTERNAL_ERROR",
            "error_details": [str(exc)] if settings.DEBUG else [],
            "path": request.url.path,
        },
    )


@app.get("/", tags=["根路径"])
async def root():
    return {
        "name": settings.PROJECT_NAME,
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
        "api_prefix": settings.API_V1_PREFIX,
    }


@app.get("/health", tags=["健康检查"])
async def health_check():
    return {"status": "healthy", "service": "blast-notice-api"}


app.include_router(api_router, prefix=settings.API_V1_PREFIX, tags=["爆破计划"])
