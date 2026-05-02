from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class Reservation(Base):
    """预约单"""
    __tablename__ = "reservations"
    
    id = Column(Integer, primary_key=True, index=True)
    reservation_code = Column(String(50), unique=True, index=True, nullable=False)
    
    instrument_id = Column(Integer, ForeignKey("instruments.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    research_group_id = Column(Integer, ForeignKey("research_groups.id"), nullable=True)
    
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    
    purpose = Column(Text, nullable=True)
    status = Column(String(20), default="pending")
    
    is_approved = Column(Boolean, default=False)
    approved_by = Column(String(50), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    
    is_cancelled = Column(Boolean, default=False)
    cancelled_by = Column(String(50), nullable=True)
    cancelled_at = Column(DateTime, nullable=True)
    cancel_reason = Column(Text, nullable=True)
    
    import_batch_id = Column(Integer, ForeignKey("import_batches.id"), nullable=True)
    
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    
    instrument = relationship("Instrument", back_populates="reservations")
    user = relationship("User", back_populates="reservations")
    research_group = relationship("ResearchGroup", back_populates="reservations")
    swipe_logs = relationship("SwipeLog", back_populates="reservation")
    bills = relationship("Bill", back_populates="reservation")
    violations = relationship("Violation", back_populates="reservation")
    import_batch = relationship("ImportBatch", back_populates="reservations")
