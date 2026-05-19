from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from .database import engine, Base
from .routers import dependencies, licenses, exceptions, reports
from .schemas import (
    ErrorCode,
    ErrorResponse,
    LicenseExceptionNotFound,
    InvalidStatusTransition,
    NeedsManualReview,
    AlreadyProcessed,
    MissingField,
)

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="许可证例外到期日期包路径追踪API",
    description="追踪依赖许可证例外规则、到期日期和包路径追踪系统",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(MissingField)
async def missing_field_exception_handler(request: Request, exc: MissingField):
    return JSONResponse(
        status_code=400,
        content=ErrorResponse(
            error_code=ErrorCode.MISSING_FIELD,
            message=f"Missing required field: {exc.field_name}",
            details={"field": exc.field_name}
        ).dict()
    )


@app.exception_handler(InvalidStatusTransition)
async def invalid_status_handler(request: Request, exc: InvalidStatusTransition):
    return JSONResponse(
        status_code=400,
        content=ErrorResponse(
            error_code=ErrorCode.INVALID_STATUS,
            message=str(exc),
            details={}
        ).dict()
    )


@app.exception_handler(NeedsManualReview)
async def needs_manual_review_handler(request: Request, exc: NeedsManualReview):
    return JSONResponse(
        status_code=409,
        content=ErrorResponse(
            error_code=ErrorCode.NEEDS_MANUAL_REVIEW,
            message=str(exc),
            details={}
        ).dict()
    )


@app.exception_handler(AlreadyProcessed)
async def already_processed_handler(request: Request, exc: AlreadyProcessed):
    return JSONResponse(
        status_code=409,
        content=ErrorResponse(
            error_code=ErrorCode.ALREADY_PROCESSED,
            message=str(exc),
            details={}
        ).dict()
    )


@app.exception_handler(LicenseExceptionNotFound)
async def not_found_handler(request: Request, exc: LicenseExceptionNotFound):
    return JSONResponse(
        status_code=404,
        content=ErrorResponse(
            error_code=ErrorCode.NOT_FOUND,
            message=str(exc),
            details={}
        ).dict()
    )

app.include_router(dependencies.router, prefix="/api/v1/dependencies", tags=["dependencies"])
app.include_router(licenses.router, prefix="/api/v1/licenses", tags=["licenses"])
app.include_router(exceptions.router, prefix="/api/v1/exceptions", tags=["exceptions"])
app.include_router(reports.router, prefix="/api/v1/reports", tags=["reports"])


@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": "1.0.0"}
