from pydantic import BaseModel
from typing import Optional, Any, List


class ErrorResponse(BaseModel):
    error_code: str
    message: str
    details: Optional[Any] = None


class ValidationErrorResponse(ErrorResponse):
    error_code: str = "VALIDATION_ERROR"
    message: str = "请求参数验证失败"
    missing_fields: Optional[List[str]] = None


class StatusNotAllowedResponse(ErrorResponse):
    error_code: str = "STATUS_NOT_ALLOWED"
    message: str = "当前状态不允许此操作"
    current_status: str
    allowed_statuses: List[str]


class ManualReviewRequiredResponse(ErrorResponse):
    error_code: str = "MANUAL_REVIEW_REQUIRED"
    message: str = "需要人工复核"
    review_reason: str


class AlreadyProcessedResponse(ErrorResponse):
    error_code: str = "ALREADY_PROCESSED"
    message: str = "该记录已被处理，无法重复操作"
    processed_at: Optional[str] = None
    processed_by: Optional[str] = None


class SuccessResponse(BaseModel):
    success: bool = True
    message: Optional[str] = None
    data: Optional[Any] = None
