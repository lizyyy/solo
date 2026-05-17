from fastapi import Request, status
from fastapi.responses import JSONResponse
from schemas import ErrorResponse

class APIException(Exception):
    def __init__(self, error_code: str, message: str, status_code: int, details: dict = None):
        self.error_code = error_code
        self.message = message
        self.status_code = status_code
        self.details = details

class MissingFieldException(APIException):
    def __init__(self, field: str, message: str = None):
        super().__init__(
            error_code="MISSING_FIELD",
            message=message or f"缺少必填字段: {field}",
            status_code=status.HTTP_400_BAD_REQUEST,
            details={"field": field}
        )

class InvalidStatusException(APIException):
    def __init__(self, current_status: str, allowed_statuses: list, message: str = None):
        super().__init__(
            error_code="INVALID_STATUS",
            message=message or f"当前状态 '{current_status}' 不允许此操作",
            status_code=status.HTTP_409_CONFLICT,
            details={
                "current_status": current_status,
                "allowed_statuses": allowed_statuses
            }
        )

class NeedsReviewException(APIException):
    def __init__(self, item_id: int, review_notes: str = None, message: str = None):
        super().__init__(
            error_code="NEEDS_REVIEW",
            message=message or "此项需要人工复核",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            details={
                "item_id": item_id,
                "review_notes": review_notes
            }
        )

class AlreadyProcessedException(APIException):
    def __init__(self, item_id: int, message: str = None):
        super().__init__(
            error_code="ALREADY_PROCESSED",
            message=message or "此项已处理过",
            status_code=status.HTTP_409_CONFLICT,
            details={"item_id": item_id}
        )

class NotFoundException(APIException):
    def __init__(self, resource: str, resource_id: int, message: str = None):
        super().__init__(
            error_code="NOT_FOUND",
            message=message or f"{resource} 不存在",
            status_code=status.HTTP_404_NOT_FOUND,
            details={"resource": resource, "id": resource_id}
        )

class InvalidDateFormatException(APIException):
    def __init__(self, raw_date: str, message: str = None):
        super().__init__(
            error_code="INVALID_DATE_FORMAT",
            message=message or f"无法解析日期格式: {raw_date}",
            status_code=status.HTTP_400_BAD_REQUEST,
            details={"raw_date": raw_date}
        )

class DuplicatePersonException(APIException):
    def __init__(self, name: str, message: str = None):
        super().__init__(
            error_code="DUPLICATE_PERSON",
            message=message or f"负责人 '{name}' 已存在",
            status_code=status.HTTP_409_CONFLICT,
            details={"name": name}
        )

async def api_exception_handler(request: Request, exc: APIException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error_code": exc.error_code,
            "message": exc.message,
            "details": exc.details
        }
    )

def register_exception_handlers(app):
    app.add_exception_handler(APIException, api_exception_handler)
