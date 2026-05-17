from fastapi import HTTPException, status


class ValidationException(HTTPException):
    def __init__(self, message: str, field: str = None, details: dict = None):
        error_details = {"message": message}
        if field:
            error_details["field"] = field
        if details:
            error_details.update(details)
        super().__init__(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error_code": "MISSING_OR_INVALID_FIELD",
                "message": message,
                "details": error_details
            }
        )


class InvalidStatusException(HTTPException):
    def __init__(self, message: str, current_status: str = None, expected_status: str = None):
        details = {}
        if current_status:
            details["current_status"] = current_status
        if expected_status:
            details["expected_status"] = expected_status
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "INVALID_STATUS",
                "message": message,
                "details": details
            }
        )


class ManualReviewRequiredException(HTTPException):
    def __init__(self, message: str, review_type: str = None, details: dict = None):
        error_details = {}
        if review_type:
            error_details["review_type"] = review_type
        if details:
            error_details.update(details)
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error_code": "MANUAL_REVIEW_REQUIRED",
                "message": message,
                "details": error_details
            }
        )


class AlreadyProcessedException(HTTPException):
    def __init__(self, message: str, processed_at: str = None, processor: str = None):
        details = {}
        if processed_at:
            details["processed_at"] = processed_at
        if processor:
            details["processor"] = processor
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error_code": "ALREADY_PROCESSED",
                "message": message,
                "details": details
            }
        )


class ResourceNotFoundException(HTTPException):
    def __init__(self, resource: str, resource_id: int = None):
        details = {"resource": resource}
        if resource_id:
            details["id"] = resource_id
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "NOT_FOUND",
                "message": f"{resource} not found",
                "details": details
            }
        )


class DuplicateOperationException(HTTPException):
    def __init__(self, message: str, operation_type: str = None, existing_id: int = None):
        details = {}
        if operation_type:
            details["operation_type"] = operation_type
        if existing_id:
            details["existing_id"] = existing_id
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error_code": "DUPLICATE_OPERATION",
                "message": message,
                "details": details
            }
        )
