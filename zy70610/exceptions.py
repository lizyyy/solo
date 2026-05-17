from fastapi import HTTPException, status
from schemas import ErrorCode


class APIException(HTTPException):
    def __init__(self, code: ErrorCode, message: str, details: dict = None):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": code,
                "message": message,
                "details": details or {}
            }
        )


class MissingFieldException(APIException):
    def __init__(self, field_name: str):
        super().__init__(
            code=ErrorCode.MISSING_FIELD,
            message=f"缺少必填字段: {field_name}",
            details={"field": field_name}
        )


class InvalidStatusException(APIException):
    def __init__(self, current_status: str, expected_status: str):
        super().__init__(
            code=ErrorCode.INVALID_STATUS,
            message=f"当前状态不允许此操作",
            details={"current_status": current_status, "expected_status": expected_status}
        )


class ReviewRequiredException(APIException):
    def __init__(self, message: str = "需要人工复核"):
        super().__init__(
            code=ErrorCode.REVIEW_REQUIRED,
            message=message
        )


class AlreadyProcessedException(APIException):
    def __init__(self, message: str = "该记录已处理"):
        super().__init__(
            code=ErrorCode.ALREADY_PROCESSED,
            message=message
        )


class DuplicateEntryException(APIException):
    def __init__(self, message: str = "重复入库"):
        super().__init__(
            code=ErrorCode.DUPLICATE_ENTRY,
            message=message
        )


class NotFoundException(APIException):
    def __init__(self, resource: str, resource_id: int = None):
        message = f"{resource}不存在"
        if resource_id:
            message = f"{resource} ID:{resource_id} 不存在"
        super().__init__(
            code=ErrorCode.NOT_FOUND,
            message=message
        )
