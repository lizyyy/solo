from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum

class HazardLevel(str, enum.Enum):
    GENERAL = "general"
    SERIOUS = "serious"
    SEVERE = "severe"
    EMERGENCY = "emergency"

class HazardStatus(str, enum.Enum):
    PENDING_REVIEW = "pending_review"
    BLOCKED = "blocked"
    APPROVED = "approved"
    IN_PROGRESS = "in_progress"
    PENDING_RECHECK = "pending_recheck"
    COMPLETED = "completed"
    CLOSED = "closed"

class OperationType(str, enum.Enum):
    REGISTER = "register"
    BLOCK = "block"
    APPROVE = "approve"
    ASSIGN = "assign"
    RECHECK_SUBMIT = "recheck_submit"
    COMPLETE = "complete"
    CLOSE = "close"
    MODIFY = "modify"
    WITHDRAW = "withdraw"
    RESUBMIT = "resubmit"

class Hazard(Base):
    __tablename__ = "hazards"

    id = Column(Integer, primary_key=True, index=True)
    tree_number = Column(String(50), index=True, nullable=False)
    road_location = Column(String(200), nullable=False)
    location_hash = Column(String(64), index=True)
    photo_path = Column(Text)
    hazard_level = Column(Enum(HazardLevel), nullable=False)
    disposal_team = Column(String(100))
    status = Column(Enum(HazardStatus), default=HazardStatus.PENDING_REVIEW)
    recheck_conclusion = Column(Text)
    batch_id = Column(String(64), index=True)
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    is_duplicate = Column(Integer, default=0)
    original_hazard_id = Column(Integer, ForeignKey("hazards.id"))
    level_modified_count = Column(Integer, default=0)

    operations = relationship("OperationLog", back_populates="hazard")
    original = relationship("Hazard", remote_side=[id])

class OperationLog(Base):
    __tablename__ = "operation_logs"

    id = Column(Integer, primary_key=True, index=True)
    hazard_id = Column(Integer, ForeignKey("hazards.id"))
    operation_type = Column(Enum(OperationType), nullable=False)
    operator = Column(String(100))
    remark = Column(Text)
    old_status = Column(Enum(HazardStatus))
    new_status = Column(Enum(HazardStatus))
    old_level = Column(Enum(HazardLevel))
    new_level = Column(Enum(HazardLevel))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    hazard = relationship("Hazard", back_populates="operations")
