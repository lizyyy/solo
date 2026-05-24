from fastapi import HTTPException, status
from app.schemas import ErrorCode
from typing import List, Optional


class BlastNoticeException(HTTPException):
    def __init__(
        self,
        status_code: int,
        message: str,
        error_code: ErrorCode,
        error_details: Optional[List[str]] = None,
    ):
        super().__init__(status_code=status_code, detail=message)
        self.error_code = error_code
        self.error_details = error_details or []
        self.message = message


class MissingDataException(BlastNoticeException):
    def __init__(self, message: str = "缺少必要材料", error_details: Optional[List[str]] = None):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            message=message,
            error_code=ErrorCode.MISSING_DATA,
            error_details=error_details,
        )


class InvalidStatusException(BlastNoticeException):
    def __init__(self, message: str = "当前状态不允许此操作", error_details: Optional[List[str]] = None):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            message=message,
            error_code=ErrorCode.INVALID_STATUS,
            error_details=error_details,
        )


class DuplicateRequestException(BlastNoticeException):
    def __init__(self, message: str = "重复请求，业务编号已存在", error_details: Optional[List[str]] = None):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            message=message,
            error_code=ErrorCode.DUPLICATE_REQUEST,
            error_details=error_details,
        )


class NeedsReviewException(BlastNoticeException):
    def __init__(self, message: str = "需要复核", error_details: Optional[List[str]] = None):
        super().__init__(
            status_code=status.HTTP_412_PRECONDITION_FAILED,
            message=message,
            error_code=ErrorCode.NEEDS_REVIEW,
            error_details=error_details,
        )


class WindCheckFailedException(BlastNoticeException):
    def __init__(self, message: str = "风向校验不通过", error_details: Optional[List[str]] = None):
        super().__init__(
            status_code=status.HTTP_412_PRECONDITION_FAILED,
            message=message,
            error_code=ErrorCode.WIND_CHECK_FAILED,
            error_details=error_details,
        )


class ReceiptMissingException(BlastNoticeException):
    def __init__(self, message: str = "回执缺失", error_details: Optional[List[str]] = None):
        super().__init__(
            status_code=status.HTTP_412_PRECONDITION_FAILED,
            message=message,
            error_code=ErrorCode.RECEIPT_MISSING,
            error_details=error_details,
        )


class ZoneChangedException(BlastNoticeException):
    def __init__(self, message: str = "警戒线变更未同步", error_details: Optional[List[str]] = None):
        super().__init__(
            status_code=status.HTTP_412_PRECONDITION_FAILED,
            message=message,
            error_code=ErrorCode.ZONE_CHANGED,
            error_details=error_details,
        )


class NotFoundException(BlastNoticeException):
    def __init__(self, message: str = "资源不存在", error_details: Optional[List[str]] = None):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            message=message,
            error_code=ErrorCode.NOT_FOUND,
            error_details=error_details,
        )
