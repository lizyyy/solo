from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Enum as SQLEnum, Text, ForeignKey, Date
from sqlalchemy.orm import relationship
import enum

from app.core.database import Base


class ApprovalType(str, enum.Enum):
    SEAL = "seal"
    UNSEAL = "unseal"
    DISCARD = "discard"
    SPECIAL_BORROW = "special_borrow"
    CALIBRATION_CANCEL = "calibration_cancel"


class ApprovalStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class ApprovalRequest(Base):
    __tablename__ = "approval_requests"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    request_no = Column(String(50), unique=True, nullable=False, index=True)
    approval_type = Column(SQLEnum(ApprovalType), nullable=False, index=True)
    
    instrument_id = Column(Integer, ForeignKey("instruments.id"), nullable=False, index=True)
    
    reason = Column(Text, nullable=False)
    expected_action_date = Column(Date)
    
    requester_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    requester_name = Column(String(100))
    
    approver_id = Column(Integer, ForeignKey("users.id"))
    approver_name = Column(String(100))
    
    status = Column(SQLEnum(ApprovalStatus), default=ApprovalStatus.PENDING, nullable=False, index=True)
    
    approval_remark = Column(Text)
    approval_date = Column(DateTime)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    instrument = relationship("Instrument", back_populates="approval_requests")
