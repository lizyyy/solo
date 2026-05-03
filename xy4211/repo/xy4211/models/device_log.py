from dataclasses import dataclass, field
from typing import Optional, Dict, Any
from datetime import datetime
from enum import Enum


class LogLevel(Enum):
    DEBUG = "debug"
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class LogEventType(Enum):
    DEVICE_START = "device_start"
    DEVICE_STOP = "device_stop"
    SCREENING_START = "screening_start"
    SCREENING_COMPLETE = "screening_complete"
    SCREENING_ABORT = "screening_abort"
    CALIBRATION_CHECK = "calibration_check"
    ERROR_OCCURRED = "error_occurred"
    USER_ACTION = "user_action"
    SYSTEM_EVENT = "system_event"


@dataclass
class DeviceLog:
    log_id: str
    device_id: str
    log_timestamp: datetime
    level: LogLevel = LogLevel.INFO
    event_type: Optional[LogEventType] = None
    message: str = ""
    details: Dict[str, Any] = field(default_factory=dict)
    screening_id: Optional[str] = None
    student_id: Optional[str] = None
    import_timestamp: datetime = field(default_factory=datetime.now)
    source_file: Optional[str] = None
    raw_data: dict = field(default_factory=dict)
    
    def to_dict(self) -> dict:
        return {
            "log_id": self.log_id,
            "device_id": self.device_id,
            "log_timestamp": self.log_timestamp.isoformat(),
            "level": self.level.value,
            "event_type": self.event_type.value if self.event_type else None,
            "message": self.message,
            "details": self.details,
            "screening_id": self.screening_id,
            "student_id": self.student_id,
            "import_timestamp": self.import_timestamp.isoformat(),
            "source_file": self.source_file
        }
    
    @classmethod
    def from_dict(cls, data: dict) -> "DeviceLog":
        log_timestamp = datetime.now()
        if data.get("log_timestamp"):
            try:
                log_timestamp = datetime.fromisoformat(data["log_timestamp"])
            except (ValueError, TypeError):
                pass
        
        import_timestamp = datetime.now()
        if data.get("import_timestamp"):
            try:
                import_timestamp = datetime.fromisoformat(data["import_timestamp"])
            except (ValueError, TypeError):
                pass
        
        level = LogLevel.INFO
        if data.get("level"):
            try:
                level = LogLevel(data["level"])
            except ValueError:
                pass
        
        event_type = None
        if data.get("event_type"):
            try:
                event_type = LogEventType(data["event_type"])
            except ValueError:
                pass
        
        return cls(
            log_id=data.get("log_id", ""),
            device_id=data.get("device_id", ""),
            log_timestamp=log_timestamp,
            level=level,
            event_type=event_type,
            message=data.get("message", ""),
            details=data.get("details", {}),
            screening_id=data.get("screening_id"),
            student_id=data.get("student_id"),
            import_timestamp=import_timestamp,
            source_file=data.get("source_file")
        )
