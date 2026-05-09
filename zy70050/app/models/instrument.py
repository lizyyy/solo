from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Enum as SQLEnum, Text, ForeignKey
from sqlalchemy.orm import relationship
import enum

from app.core.database import Base


class InstrumentStatus(str, enum.Enum):
    IN_STOCK = "in_stock"
    BORROWED = "borrowed"
    CALIBRATING = "calibrating"
    SEALED = "sealed"
    DISCARDED = "discarded"


class Instrument(Base):
    __tablename__ = "instruments"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    specification = Column(String(200))
    serial_number = Column(String(100))
    manufacturer = Column(String(100))
    accuracy = Column(String(50))
    measurement_range = Column(String(100))
    location = Column(String(100))
    
    status = Column(SQLEnum(InstrumentStatus), default=InstrumentStatus.IN_STOCK, nullable=False, index=True)
    
    calibration_period_months = Column(Integer, default=12, nullable=False)
    last_calibration_date = Column(DateTime)
    next_calibration_date = Column(DateTime, index=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"))
    
    borrows = relationship("Borrow", back_populates="instrument")
    calibrations = relationship("Calibration", back_populates="instrument")
    histories = relationship("InstrumentHistory", back_populates="instrument")
    approval_requests = relationship("ApprovalRequest", back_populates="instrument")
