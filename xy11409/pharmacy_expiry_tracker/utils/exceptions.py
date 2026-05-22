from pharmacy_expiry_tracker.models.enums import ExitCode


class AppException(Exception):
    exit_code: ExitCode = ExitCode.ERROR

    def __init__(self, message: str, details: dict = None):
        self.message = message
        self.details = details or {}
        super().__init__(self.message)


class ValidationException(AppException):
    exit_code = ExitCode.VALIDATION_ERROR


class NotFoundException(AppException):
    exit_code = ExitCode.NOT_FOUND


class DuplicateException(AppException):
    exit_code = ExitCode.DUPLICATE


class PermissionDeniedException(AppException):
    exit_code = ExitCode.PERMISSION_DENIED


class InvalidStateException(AppException):
    exit_code = ExitCode.INVALID_STATE


class PartialFailureException(AppException):
    exit_code = ExitCode.PARTIAL_FAILURE

    def __init__(self, message: str, success_count: int, failure_count: int, details: dict = None):
        self.success_count = success_count
        self.failure_count = failure_count
        super().__init__(message, details)
