from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base


class SwipeLog(Base):
    """门禁刷卡日志"""
    __tablename__ = "swipe_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    swipe_code = Column(String(50), unique=True, index=True, nullable=True)
    
    instrument_id = Column(Integer, ForeignKey("instruments.id"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    reservation_id = Column(Integer, ForeignKey("reservations.id"), nullable=True)
    
    card_number = Column(String(50), nullable=False)
    swipe_time = Column(DateTime, nullable=False)
    
    swipe_type = Column(String(20), default="enter")
    device_id = Column(String(50), nullable=True)
    
    is_matched = Column(Boolean, default=False)
    match_status = Column(String(50), nullable=True)
    
    is_manual_release = Column(Boolean, default=False)
    manual_release_by = Column(String(50), nullable=True)
    manual_release_reason = Column(Text, nullable=True)
    
    import_batch_id = Column(Integer, ForeignKey("import_batches.id"), nullable=True)
    
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    
    instrument = relationship("Instrument", back_populates="swipe_logs")
    user = relationship("User", back_populates="swipe_logs")
    reservation = relationship("Reservation", back_populates="swipe_logs")
    violations = relationship("Violation", back_populates="swipe_log")
    import_batch = relationship("ImportBatch", back_populates="swipe_logs")
