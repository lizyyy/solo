class CanteenException(Exception):
    pass


class ImportException(CanteenException):
    def __init__(self, message: str, fix_suggestion: str = None):
        self.message = message
        self.fix_suggestion = fix_suggestion
        super().__init__(message)


class ValidationException(ImportException):
    pass


class DatabaseException(ImportException):
    pass


class RecordNotFoundException(CanteenException):
    pass


class BatchOperationException(CanteenException):
    def __init__(self, message: str, successful_ids: list = None, failed_ids: list = None):
        self.message = message
        self.successful_ids = successful_ids or []
        self.failed_ids = failed_ids or []
        super().__init__(message)
