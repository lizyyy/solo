import enum
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text, Boolean
from app.models.base import BaseModel


class ExceptionType(enum.Enum):
    DATA_INCONSISTENCY = "DATA_INCONSISTENCY"
    MISSING_DATA = "MISSING_DATA"
    INVALID_DATA = "INVALID_DATA"
    TIMESTAMP_CONFLICT = "TIMESTAMP_CONFLICT"
    RANKING_CONFLICT = "RANKING_CONFLICT"
    PROCESSING_ERROR = "PROCESSING_ERROR"


class ExceptionRecord(BaseModel):
    """异常记录"""

    __tablename__ = "exception_records"

    exception_type = Column(String(50), nullable=False, index=True)
    source_module = Column(String(100), nullable=True)
    severity = Column(String(20), default="MEDIUM")  # LOW, MEDIUM, HIGH, CRITICAL
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    raw_data = Column(Text, nullable=True)
    related_record_id = Column(String(100), nullable=True, index=True)
    related_record_type = Column(String(50), nullable=True)
    status = Column(String(20), nullable=False, default="OPEN")  # OPEN, RESOLVED, IGNORED
    is_handled = Column(Boolean, default=False, nullable=False)
    handled_at = Column(DateTime, nullable=True)
    handled_by = Column(String(100), nullable=True)
    resolution_notes = Column(Text, nullable=True)
