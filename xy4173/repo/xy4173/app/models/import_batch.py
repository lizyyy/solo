from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text
from sqlalchemy.orm import relationship
from app.core.database import Base


class ImportBatch(Base):
    """导入批次记录"""
    __tablename__ = "import_batches"
    
    id = Column(Integer, primary_key=True, index=True)
    batch_code = Column(String(50), unique=True, index=True, nullable=False)
    
    import_type = Column(String(50), nullable=False)
    
    file_name = Column(String(255), nullable=True)
    file_size = Column(Integer, default=0)
    file_hash = Column(String(64), nullable=True)
    
    total_records = Column(Integer, default=0)
    imported_records = Column(Integer, default=0)
    failed_records = Column(Integer, default=0)
    skipped_records = Column(Integer, default=0)
    
    status = Column(String(20), default="pending")
    
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    
    error_message = Column(Text, nullable=True)
    
    imported_by = Column(String(50), nullable=True)
    imported_by_name = Column(String(100), nullable=True)
    
    notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    
    reservations = relationship("Reservation", back_populates="import_batch")
    swipe_logs = relationship("SwipeLog", back_populates="import_batch")
    samples = relationship("SampleRegistration", back_populates="import_batch")
    bills = relationship("Bill", back_populates="import_batch")
    violations = relationship("Violation", back_populates="import_batch")
