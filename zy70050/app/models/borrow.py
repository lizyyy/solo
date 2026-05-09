from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Enum as SQLEnum, Text, ForeignKey, Date
from sqlalchemy.orm import relationship
import enum

from app.core.database import Base


class BorrowStatus(str, enum.Enum):
    PENDING = "pending"
    BORROWED = "borrowed"
    RETURNED = "returned"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"


class Borrow(Base):
    __tablename__ = "borrows"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    instrument_id = Column(Integer, ForeignKey("instruments.id"), nullable=False, index=True)
    borrower_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    purpose = Column(String(200), nullable=False)
    department = Column(String(100), nullable=False)
    workshop = Column(String(100))
    work_order = Column(String(50))
    
    borrow_date = Column(Date, nullable=False)
    expected_return_date = Column(Date, nullable=False, index=True)
    actual_return_date = Column(Date, index=True)
    
    status = Column(SQLEnum(BorrowStatus), default=BorrowStatus.PENDING, nullable=False, index=True)
    is_overdue = Column(Boolean, default=False, nullable=False)
    overdue_notice_count = Column(Integer, default=0, nullable=False)
    last_overdue_notice_at = Column(DateTime)
    
    return_condition = Column(String(500))
    remarks = Column(Text)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"))
    
    instrument = relationship("Instrument", back_populates="borrows")
    borrower = relationship("User", foreign_keys=[borrower_id])
