from datetime import datetime, timezone
from fastapi import Request
from fastapi.responses import JSONResponse
from app.schemas import ErrorResponse


class DataFreshnessException(Exception):
    def __init__(self, error_code: str, message: str, status_code: int = 400, details: dict = None):
        self.error_code = error_code
        self.message = message
        self.status_code = status_code
        self.details = details
        super().__init__(message)


def create_error_response(error_code: str, message: str, details: dict = None) -> dict:
    return ErrorResponse(
        error_code=error_code,
        message=message,
        details=details,
        timestamp=datetime.now(timezone.utc)
    ).dict()


async def data_freshness_exception_handler(request: Request, exc: DataFreshnessException):
    return JSONResponse(
        status_code=exc.status_code,
        content=create_error_response(exc.error_code, exc.message, exc.details)
    )


async def general_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content=create_error_response(
            "INTERNAL_ERROR",
            "服务器内部错误",
            {"type": type(exc).__name__}
        )
    )
