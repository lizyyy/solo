class WaitlistAPIException(Exception):
    status_code = 400
    error_code = "WAITLIST_ERROR"

    def __init__(self, message, error_code=None, status_code=None, details=None):
        super().__init__(message)
        self.message = message
        if error_code:
            self.error_code = error_code
        if status_code:
            self.status_code = status_code
        self.details = details or {}

    def to_dict(self):
        return {
            "success": False,
            "error": {
                "code": self.error_code,
                "message": self.message,
                "details": self.details
            }
        }


class RecordConflictException(WaitlistAPIException):
    error_code = "RECORD_CONFLICT"

    def __init__(self, message, existing_record=None, conflicting_data=None):
        details = {}
        if existing_record:
            details["existing_record"] = {
                "id": existing_record.id,
                "lecture_id": existing_record.lecture_id,
                "reader_id": existing_record.reader_id,
                "waitlist_number": existing_record.waitlist_number,
                "status": existing_record.status.value,
                "version": existing_record.version
            }
        if conflicting_data:
            details["conflicting_data"] = conflicting_data
        super().__init__(message, details=details)


class VersionMismatchException(WaitlistAPIException):
    error_code = "VERSION_MISMATCH"

    def __init__(self, message, expected_version, actual_version):
        details = {
            "expected_version": expected_version,
            "actual_version": actual_version
        }
        super().__init__(message, details=details)


class WaitlistOrderConflictException(WaitlistAPIException):
    error_code = "WAITLIST_ORDER_CONFLICT"

    def __init__(self, message, lecture_id, waitlist_number, existing_readers=None):
        details = {
            "lecture_id": lecture_id,
            "conflicting_waitlist_number": waitlist_number
        }
        if existing_readers:
            details["readers_at_this_position"] = [
                {"reader_id": r.reader_id, "reader_name": r.reader_name}
                for r in existing_readers
            ]
        super().__init__(message, details=details)


class ManualAdmissionConflictException(WaitlistAPIException):
    error_code = "MANUAL_ADMISSION_CONFLICT"

    def __init__(self, message, lecture_id, reader_id, current_status):
        details = {
            "lecture_id": lecture_id,
            "reader_id": reader_id,
            "current_status": current_status.value
        }
        super().__init__(message, details=details)


class DuplicateReaderException(WaitlistAPIException):
    error_code = "DUPLICATE_READER"

    def __init__(self, message, lecture_id, reader_id):
        details = {
            "lecture_id": lecture_id,
            "reader_id": reader_id
        }
        super().__init__(message, details=details)


class InvalidDataException(WaitlistAPIException):
    error_code = "INVALID_DATA"

    def __init__(self, message, field_errors=None):
        details = {"field_errors": field_errors or {}}
        super().__init__(message, details=details)


class RecordNotFoundException(WaitlistAPIException):
    error_code = "RECORD_NOT_FOUND"
    status_code = 404

    def __init__(self, message, record_id=None):
        details = {"record_id": record_id} if record_id else {}
        super().__init__(message, status_code=404, details=details)
