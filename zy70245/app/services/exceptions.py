class BusinessError(Exception):
    code = 'BUSINESS_ERROR'
    http_code = 400

    def __init__(self, message, details=None):
        super().__init__(message)
        self.message = message
        self.details = details or {}


class RiderNotActiveError(BusinessError):
    code = 'RIDER_NOT_ACTIVE'
    http_code = 403


class RiderNotFoundError(BusinessError):
    code = 'RIDER_NOT_FOUND'
    http_code = 404


class BatchNotQualifiedError(BusinessError):
    code = 'BATCH_NOT_QUALIFIED'
    http_code = 400


class EquipmentNotAvailableError(BusinessError):
    code = 'EQUIPMENT_NOT_AVAILABLE'
    http_code = 400


class EquipmentNotFoundError(BusinessError):
    code = 'EQUIPMENT_NOT_FOUND'
    http_code = 404


class BatchNotFoundError(BusinessError):
    code = 'BATCH_NOT_FOUND'
    http_code = 404


class SignatureMismatchError(BusinessError):
    code = 'SIGNATURE_MISMATCH'
    http_code = 400


class RecordAlreadyConfirmedError(BusinessError):
    code = 'RECORD_ALREADY_CONFIRMED'
    http_code = 400


class RecordNotFoundError(BusinessError):
    code = 'RECORD_NOT_FOUND'
    http_code = 404


class EquipmentAlreadyIssuedError(BusinessError):
    code = 'EQUIPMENT_ALREADY_ISSUED'
    http_code = 400


class InvalidStatusTransitionError(BusinessError):
    code = 'INVALID_STATUS_TRANSITION'
    http_code = 400


class CompensationNotFoundError(BusinessError):
    code = 'COMPENSATION_NOT_FOUND'
    http_code = 404


class RiderHasOutstandingEquipmentError(BusinessError):
    code = 'RIDER_HAS_OUTSTANDING_EQUIPMENT'
    http_code = 400


class ReconciliationError(BusinessError):
    code = 'RECONCILIATION_ERROR'
    http_code = 400
