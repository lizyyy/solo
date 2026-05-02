from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class Violation(Base):
    """违规记录"""
    __tablename__ = "violations"
    
    id = Column(Integer, primary_key=True, index=True)
    violation_code = Column(String(50), unique=True, index=True, nullable=False)
    
    violation_type = Column(String(50), nullable=False)
    
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    reservation_id = Column(Integer, ForeignKey("reservations.id"), nullable=True)
    swipe_log_id = Column(Integer, ForeignKey("swipe_logs.id"), nullable=True)
    sample_id = Column(Integer, ForeignKey("sample_registrations.id"), nullable=True)
    bill_id = Column(Integer, ForeignKey("bills.id"), nullable=True)
    
    instrument_id = Column(Integer, ForeignKey("instruments.id"), nullable=True)
    research_group_id = Column(Integer, ForeignKey("research_groups.id"), nullable=True)
    
    detected_at = Column(DateTime, nullable=False)
    
    severity = Column(String(20), default="low")
    
    description = Column(Text, nullable=True)
    details = Column(Text, nullable=True)
    
    suggested_fine_amount = Column(Float, default=0.0)
    
    status = Column(String(20), default="pending")
    
    is_resolved = Column(Boolean, default=False)
    resolved_by = Column(String(50), nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    resolution_notes = Column(Text, nullable=True)
    
    import_batch_id = Column(Integer, ForeignKey("import_batches.id"), nullable=True)
    
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    
    reservation = relationship("Reservation", back_populates="violations")
    swipe_log = relationship("SwipeLog", back_populates="violations")
    sample = relationship("SampleRegistration", back_populates="violations")
    bill = relationship("Bill", back_populates="violations")
    reviews = relationship("Review", back_populates="violation")
    import_batch = relationship("ImportBatch", back_populates="violations")
