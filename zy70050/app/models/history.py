from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Enum as SQLEnum, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
import enum

from app.core.database import Base


class HistoryAction(str, enum.Enum):
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    BORROW = "borrow"
    RETURN = "return"
    CALIBRATE = "calibrate"
    SEAL = "seal"
    UNSEAL = "unseal"
    APPROVE = "approve"
    REJECT = "reject"
    RECTIFY = "rectify"
    WITHDRAW = "withdraw"
    STATUS_CHANGE = "status_change"


class InstrumentHistory(Base):
    __tablename__ = "instrument_histories"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    instrument_id = Column(Integer, ForeignKey("instruments.id"), nullable=False, index=True)
    
    action = Column(SQLEnum(HistoryAction), nullable=False, index=True)
    action_description = Column(String(500), nullable=False)
    
    old_status = Column(String(50))
    new_status = Column(String(50))
    
    old_values = Column(JSON)
    new_values = Column(JSON)
    
    created_by = Column(Integer, ForeignKey("users.id"))
    created_by_name = Column(String(100))
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    remark = Column(Text)
    
    instrument = relationship("Instrument", back_populates="histories")
