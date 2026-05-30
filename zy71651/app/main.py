from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import engine, Base
from .api import students, materials, tasks
from .schemas import ErrorResponse, ErrorDetail


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    description="3D打印支撑量估算后端服务 - 用于创客空间老师在收模型前估算支撑材料和打印时间",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    error_response = ErrorResponse(
        code=exc.status_code,
        message=exc.detail,
        details=None,
    )
    return JSONResponse(
        status_code=exc.status_code,
        content=error_response.model_dump(),
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    error_response = ErrorResponse(
        code=500,
        message="服务器内部错误",
        details=[ErrorDetail(
            code="internal_error",
            message=str(exc),
            suggestion="请联系管理员或查看日志",
        )],
    )
    return JSONResponse(
        status_code=500,
        content=error_response.model_dump(),
    )


@app.get("/health", tags=["系统"])
async def health_check():
    return {
        "status": "healthy",
        "app": settings.app_name,
        "version": settings.version,
    }


@app.get("/", tags=["系统"])
async def root():
    return {
        "name": settings.app_name,
        "version": settings.version,
        "description": "3D打印支撑量估算后端服务",
        "docs": "/docs",
        "api_prefix": settings.api_prefix,
    }


api_prefix = settings.api_prefix
app.include_router(students.router, prefix=api_prefix)
app.include_router(materials.router, prefix=api_prefix)
app.include_router(tasks.router, prefix=api_prefix)
