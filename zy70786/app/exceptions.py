from typing import Any, Dict, Optional
from fastapi import HTTPException, status


class BundleBudgetException(HTTPException):
    error_code: str
    details: Optional[Dict[str, Any]]

    def __init__(
        self,
        status_code: int,
        error_code: str,
        message: str,
        details: Optional[Dict[str, Any]] = None,
    ) -> None:
        super().__init__(status_code=status_code, detail=message)
        self.error_code = error_code
        self.details = details


class MissingFieldException(BundleBudgetException):
    def __init__(self, field_name: str, message: Optional[str] = None):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            error_code="MISSING_REQUIRED_FIELD",
            message=message or f"Missing required field: {field_name}",
            details={"field": field_name},
        )


class InvalidStatusException(BundleBudgetException):
    def __init__(self, current_status: str, allowed_statuses: list, message: Optional[str] = None):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            error_code="INVALID_STATUS_TRANSITION",
            message=message or f"Operation not allowed in current status: {current_status}",
            details={"current_status": current_status, "allowed_statuses": allowed_statuses},
        )


class NeedsReviewException(BundleBudgetException):
    def __init__(self, report_id: int, message: Optional[str] = None):
        super().__init__(
            status_code=status.HTTP_412_PRECONDITION_FAILED,
            error_code="NEEDS_MANUAL_REVIEW",
            message=message or "This report requires manual review before processing",
            details={"report_id": report_id},
        )


class AlreadyProcessedException(BundleBudgetException):
    def __init__(self, report_id: int, message: Optional[str] = None):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            error_code="ALREADY_PROCESSED",
            message=message or f"Report has already been processed",
            details={"report_id": report_id},
        )


class NotFoundException(BundleBudgetException):
    def __init__(self, resource_type: str, resource_id: Any, message: Optional[str] = None):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            error_code="RESOURCE_NOT_FOUND",
            message=message or f"{resource_type} not found: {resource_id}",
            details={"resource_type": resource_type, "resource_id": resource_id},
        )


class DuplicateBuildException(BundleBudgetException):
    def __init__(self, build_id: str, message: Optional[str] = None):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            error_code="DUPLICATE_BUILD",
            message=message or f"Build already exists: {build_id}",
            details={"build_id": build_id},
        )
