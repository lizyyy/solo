class PerfTrainerError(Exception):
    """Base exception for all Perf Trainer errors"""
    pass


class IncidentNotFoundError(PerfTrainerError):
    """Raised when incident.yaml is not found"""
    pass


class InvalidIncidentFormatError(PerfTrainerError):
    """Raised when incident.yaml has invalid format"""
    def __init__(self, message: str, field: str = None):
        super().__init__(message)
        self.field = field
        self.message = message


class SampleNotFoundError(PerfTrainerError):
    """Raised when a sample file is not found"""
    def __init__(self, sample_name: str):
        super().__init__(f"Sample file '{sample_name}' not found")
        self.sample_name = sample_name


class InvalidStageError(PerfTrainerError):
    """Raised when an invalid stage is specified"""
    def __init__(self, stage: str, valid_stages: list):
        super().__init__(f"Invalid stage: '{stage}'. Valid stages: {', '.join(valid_stages)}")
        self.stage = stage
        self.valid_stages = valid_stages


class SessionNotFoundError(PerfTrainerError):
    """Raised when a session ID is not found in database"""
    def __init__(self, session_id: int):
        super().__init__(f"Session with ID {session_id} not found")
        self.session_id = session_id


class DatabaseError(PerfTrainerError):
    """Raised when database operations fail"""
    pass


class ExportError(PerfTrainerError):
    """Raised when export operation fails"""
    def __init__(self, format_type: str, message: str):
        super().__init__(f"Export to {format_type} failed: {message}")
        self.format_type = format_type
