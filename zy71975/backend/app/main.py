from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.database import init_db
from app.core.exceptions import QualityCheckException
from app.core.error_messages import get_user_friendly_message
from app.schemas.common import ApiResponse

from app.api import meeting, knowledge, compare, correction, history, export


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="智能质检系统 API",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=settings.CORS_METHODS,
    allow_headers=settings.CORS_HEADERS,
)


@app.exception_handler(QualityCheckException)
async def quality_check_exception_handler(request: Request, exc: QualityCheckException):
    return JSONResponse(
        status_code=exc.status_code,
        content=ApiResponse.error(
            code=exc.status_code,
            message=exc.message,
            user_friendly_message=exc.user_friendly_message,
            data=exc.details
        ).model_dump()
    )


@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    return JSONResponse(
        status_code=400,
        content=ApiResponse.error(
            code=400,
            message=str(exc),
            user_friendly_message=get_user_friendly_message(exc)
        ).model_dump()
    )


@app.exception_handler(FileNotFoundError)
async def file_not_found_handler(request: Request, exc: FileNotFoundError):
    return JSONResponse(
        status_code=404,
        content=ApiResponse.error(
            code=404,
            message=str(exc),
            user_friendly_message=get_user_friendly_message(exc)
        ).model_dump()
    )


@app.exception_handler(PermissionError)
async def permission_error_handler(request: Request, exc: PermissionError):
    return JSONResponse(
        status_code=403,
        content=ApiResponse.error(
            code=403,
            message=str(exc),
            user_friendly_message=get_user_friendly_message(exc)
        ).model_dump()
    )


@app.exception_handler(UnicodeDecodeError)
async def unicode_decode_error_handler(request: Request, exc: UnicodeDecodeError):
    return JSONResponse(
        status_code=400,
        content=ApiResponse.error(
            code=400,
            message=str(exc),
            user_friendly_message=get_user_friendly_message(exc)
        ).model_dump()
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content=ApiResponse.error(
            code=500,
            message=str(exc),
            user_friendly_message=get_user_friendly_message(exc)
        ).model_dump()
    )


@app.get("/", response_model=ApiResponse)
async def root():
    return ApiResponse.success(
        data={
            "app_name": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "status": "running"
        },
        user_friendly_message="欢迎使用智能质检系统～"
    )


@app.get("/health", response_model=ApiResponse)
async def health_check():
    return ApiResponse.success(
        data={"status": "healthy"},
        user_friendly_message="系统运行正常～"
    )


app.include_router(meeting.router, prefix="/api/v1")
app.include_router(knowledge.router, prefix="/api/v1")
app.include_router(compare.router, prefix="/api/v1")
app.include_router(correction.router, prefix="/api/v1")
app.include_router(history.router, prefix="/api/v1")
app.include_router(export.router, prefix="/api/v1")
