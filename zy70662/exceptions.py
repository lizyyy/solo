from fastapi import Request
from fastapi.responses import JSONResponse


class AppealException(Exception):
    error_code = "APPEAL_ERROR"
    status_code = 400

    def __init__(self, message: str, details: dict = None):
        self.message = message
        self.details = details or {}


class MissingFieldException(AppealException):
    error_code = "MISSING_FIELD"
    status_code = 400


class InvalidStatusException(AppealException):
    error_code = "INVALID_STATUS"
    status_code = 409


class ManualReviewRequiredException(AppealException):
    error_code = "MANUAL_REVIEW_REQUIRED"
    status_code = 422


class AlreadyProcessedException(AppealException):
    error_code = "ALREADY_PROCESSED"
    status_code = 409


class NotFoundException(AppealException):
    error_code = "NOT_FOUND"
    status_code = 404


class ValidationException(AppealException):
    error_code = "VALIDATION_ERROR"
    status_code = 400


async def appeal_exception_handler(request: Request, exc: AppealException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error_code": exc.error_code,
            "message": exc.message,
            "details": exc.details
        }
    )


def register_exception_handlers(app):
    app.add_exception_handler(AppealException, appeal_exception_handler)
    app.add_exception_handler(MissingFieldException, appeal_exception_handler)
    app.add_exception_handler(InvalidStatusException, appeal_exception_handler)
    app.add_exception_handler(ManualReviewRequiredException, appeal_exception_handler)
    app.add_exception_handler(AlreadyProcessedException, appeal_exception_handler)
    app.add_exception_handler(NotFoundException, appeal_exception_handler)
    app.add_exception_handler(ValidationException, appeal_exception_handler)
