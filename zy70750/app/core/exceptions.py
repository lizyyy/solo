from pydantic import BaseModel
from typing import Any, Optional
from app.core.constants import ErrorCode


class APIResponse(BaseModel):
    success: bool
    data: Optional[Any] = None
    message: Optional[str] = None
    error_code: Optional[ErrorCode] = None


class ErrorResponse(BaseModel):
    success: bool = False
    message: str
    error_code: ErrorCode
    details: Optional[Any] = None
