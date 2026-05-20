from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base
import enum


class LogLevel(str, enum.Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    DEBUG = "debug"


class RecoveryLog(Base):
    __tablename__ = "recovery_logs"

    id = Column(Integer, primary_key=True, index=True)
    reset_request_id = Column(Integer, ForeignKey("reset_requests.id"))
    level = Column(Enum(LogLevel), default=LogLevel.INFO)
    message = Column(Text)
    details = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(String)

    reset_request = relationship("ResetRequest", back_populates="logs")