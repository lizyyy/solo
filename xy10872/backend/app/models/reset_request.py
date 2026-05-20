from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base
import enum


class ResetStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    PROCESSING = "processing"
    SUCCESS = "success"
    FAILED = "failed"
    BLOCKED = "blocked"
    CANCELLED = "cancelled"


class ResetRequest(Base):
    __tablename__ = "reset_requests"

    id = Column(Integer, primary_key=True, index=True)
    lab_space_id = Column(Integer, ForeignKey("lab_spaces.id"))
    snapshot_id = Column(Integer, ForeignKey("base_snapshots.id"))
    requested_by = Column(String)
    requested_by_name = Column(String)
    reason = Column(Text)
    status = Column(Enum(ResetStatus), default=ResetStatus.PENDING)
    status_reason = Column(Text)
    approved_by = Column(String)
    approved_at = Column(DateTime)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    lab_space = relationship("LabSpace", back_populates="reset_requests")
    snapshot = relationship("BaseSnapshot", back_populates="reset_requests")
    retained_files = relationship("RetainedFile", back_populates="reset_request")
    logs = relationship("RecoveryLog", back_populates="reset_request")