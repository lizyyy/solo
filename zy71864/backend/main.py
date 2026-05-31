from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import SQLAlchemyError, IntegrityError

from app.config import settings
from app.database import engine, Base
from app.errors import DiagnosisError, get_human_readable_error
from app.routers import questions, evaluation_records, diagnosis, filter_conditions

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="数列递推诊断系统 - 帮助教研人员快速诊断学生数列递推题的答题情况",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(DiagnosisError)
async def diagnosis_error_handler(request: Request, exc: DiagnosisError):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error_code": exc.error_code,
            "message": exc.detail,
            "suggestion": exc.suggestion,
            "contact_person": exc.contact_person,
            "details": exc.details
        }
    )


@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError):
    error_info = get_human_readable_error("INTEGRITY_ERROR")
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={
            "error_code": error_info["error_code"],
            "message": error_info["message"],
            "suggestion": error_info["suggestion"],
            "contact_person": error_info["contact_person"],
            "details": {"original_error": str(exc.orig)}
        }
    )


@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_error_handler(request: Request, exc: SQLAlchemyError):
    error_info = get_human_readable_error("DATABASE_ERROR")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error_code": error_info["error_code"],
            "message": error_info["message"],
            "suggestion": error_info["suggestion"],
            "contact_person": error_info["contact_person"],
            "details": {"original_error": str(exc)}
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    error_info = get_human_readable_error("UNKNOWN_ERROR")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error_code": error_info["error_code"],
            "message": error_info["message"],
            "suggestion": error_info["suggestion"],
            "contact_person": error_info["contact_person"],
            "details": {"original_error": str(exc)}
        }
    )


app.include_router(questions.router, prefix=settings.API_V1_PREFIX)
app.include_router(evaluation_records.router, prefix=settings.API_V1_PREFIX)
app.include_router(diagnosis.router, prefix=settings.API_V1_PREFIX)
app.include_router(filter_conditions.router, prefix=settings.API_V1_PREFIX)


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": "1.0.0"
    }


@app.get("/")
async def root():
    return {
        "message": "欢迎使用数列递推诊断系统",
        "docs": "/docs",
        "api_prefix": settings.API_V1_PREFIX
    }
