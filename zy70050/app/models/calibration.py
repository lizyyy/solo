from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Enum as SQLEnum, Text, ForeignKey, Date, Float
from sqlalchemy.orm import relationship
import enum

from app.core.database import Base


class CalibrationStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    PASSED = "passed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class Calibration(Base):
    __tablename__ = "calibrations"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    instrument_id = Column(Integer, ForeignKey("instruments.id"), nullable=False, index=True)
    
    calibration_type = Column(String(50), nullable=False)
    calibration_date = Column(Date, index=True)
    scheduled_date = Column(Date, nullable=False, index=True)
    
    calibration_agency = Column(String(100))
    certificate_number = Column(String(100))
    certificate_file = Column(String(200))
    
    status = Column(SQLEnum(CalibrationStatus), default=CalibrationStatus.SCHEDULED, nullable=False, index=True)
    
    measurement_uncertainty = Column(String(100))
    environmental_conditions = Column(String(200))
    
    result_pass = Column(Boolean)
    remarks = Column(Text)
    
    calibrated_by = Column(Integer, ForeignKey("users.id"))
    approved_by = Column(Integer, ForeignKey("users.id"))
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    instrument = relationship("Instrument", back_populates="calibrations")
