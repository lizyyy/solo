from .constants import ExitCode, ErrorMessages


class FinanceCarrierException(Exception):
    exit_code = ExitCode.GENERAL_ERROR

    def __init__(self, message: str, details: dict = None):
        super().__init__(message)
        self.message = message
        self.details = details or {}

    def to_dict(self):
        return {
            "error": self.__class__.__name__,
            "message": self.message,
            "details": self.details,
            "exit_code": self.exit_code,
        }


class FileNotFoundException(FinanceCarrierException):
    exit_code = ExitCode.FILE_NOT_FOUND

    def __init__(self, file_path: str):
        super().__init__(ErrorMessages.FILE_NOT_FOUND.format(file_path=file_path))
        self.details = {"file_path": file_path}


class BatchConflictException(FinanceCarrierException):
    exit_code = ExitCode.BATCH_CONFLICT

    def __init__(self, batch_no: str, existing_source: str):
        super().__init__(
            ErrorMessages.BATCH_CONFLICT.format(
                batch_no=batch_no, existing_source=existing_source
            )
        )
        self.details = {"batch_no": batch_no, "existing_source": existing_source}


class ValidationException(FinanceCarrierException):
    exit_code = ExitCode.VALIDATION_ERROR

    def __init__(self, field: str, message: str):
        super().__init__(ErrorMessages.VALIDATION_ERROR.format(field=field, message=message))
        self.details = {"field": field, "message": message}


class EmptyCandidatesException(FinanceCarrierException):
    exit_code = ExitCode.EMPTY_CANDIDATES

    def __init__(self):
        super().__init__(ErrorMessages.EMPTY_CANDIDATES)


class ProcessorNotFoundException(FinanceCarrierException):
    exit_code = ExitCode.PROCESSOR_NOT_FOUND

    def __init__(self, processor: str):
        super().__init__(ErrorMessages.PROCESSOR_NOT_FOUND.format(processor=processor))
        self.details = {"processor": processor}
