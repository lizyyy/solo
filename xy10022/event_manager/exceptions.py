class EventManagerException(Exception):
    pass

class ValidationError(EventManagerException):
    pass

class NotFoundError(EventManagerException):
    pass

class PermissionDeniedError(EventManagerException):
    pass

class StateTransitionError(EventManagerException):
    pass

class DuplicateRegistrationError(EventManagerException):
    pass

class ImportExportError(EventManagerException):
    pass

class BatchOperationError(EventManagerException):
    def __init__(self, message, successful=None, failed=None):
        super().__init__(message)
        self.successful = successful or []
        self.failed = failed or []
