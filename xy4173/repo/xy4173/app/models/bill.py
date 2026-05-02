from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class Bill(Base):
    """账单"""
    __tablename__ = "bills"
    
    id = Column(Integer, primary_key=True, index=True)
    bill_code = Column(String(50), unique=True, index=True, nullable=False)
    
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    reservation_id = Column(Integer, ForeignKey("reservations.id"), nullable=True)
    
    instrument_id = Column(Integer, ForeignKey("instruments.id"), nullable=True)
    research_group_id = Column(Integer, ForeignKey("research_groups.id"), nullable=True)
    
    bill_date = Column(DateTime, nullable=False)
    
    base_duration_hours = Column(Float, default=0.0)
    base_amount = Column(Float, default=0.0)
    
    overtime_duration_hours = Column(Float, default=0.0)
    overtime_amount = Column(Float, default=0.0)
    
    night_duration_hours = Column(Float, default=0.0)
    night_amount = Column(Float, default=0.0)
    
    discount_amount = Column(Float, default=0.0)
    discount_reason = Column(Text, nullable=True)
    
    total_amount = Column(Float, default=0.0)
    
    status = Column(String(20), default="pending")
    
    is_waived = Column(Boolean, default=False)
    waive_reason = Column(Text, nullable=True)
    waived_by = Column(String(50), nullable=True)
    waived_at = Column(DateTime, nullable=True)
    
    is_paid = Column(Boolean, default=False)
    paid_at = Column(DateTime, nullable=True)
    payment_method = Column(String(50), nullable=True)
    
    notes = Column(Text, nullable=True)
    
    import_batch_id = Column(Integer, ForeignKey("import_batches.id"), nullable=True)
    
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    
    user = relationship("User", back_populates="bills")
    reservation = relationship("Reservation", back_populates="bills")
    violations = relationship("Violation", back_populates="bill")
    import_batch = relationship("ImportBatch", back_populates="bills")
