from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from app.api.routes import router as core_router
from app.api.processing import router as processing_router
from app.core.database import engine, Base
from app.core.constants import ErrorCode

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="脱敏规则回归差异报告API",
    description="脱敏规则回归差异报告失败行保留后端API",
    version="1.0.0"
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    missing_fields = []
    for error in exc.errors():
        if error["type"] == "missing":
            loc = error["loc"]
            field_name = loc[-1] if len(loc) > 0 else "unknown"
            missing_fields.append(field_name)
    
    if missing_fields:
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "message": f"Missing required fields: {', '.join(missing_fields)}",
                "error_code": ErrorCode.MISSING_FIELD,
                "details": missing_fields
            }
        )
    
    return JSONResponse(
        status_code=400,
        content={
            "success": False,
            "message": "Validation error",
            "error_code": ErrorCode.VALIDATION_ERROR,
            "details": exc.errors()
        }
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "message": str(exc),
            "error_code": "internal_server_error"
        }
    )


app.include_router(core_router)
app.include_router(processing_router)


@app.get("/")
def root():
    return {
        "message": "脱敏规则回归差异报告API",
        "version": "1.0.0",
        "docs": "/docs",
        "redoc": "/redoc"
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}
