from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, Float, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class Batch(Base):
    __tablename__ = "batches"
    
    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String(64), unique=True, index=True, nullable=False)
    file_name = Column(String(255))
    file_hash = Column(String(64), index=True)
    upload_time = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(String(32), default="processing")
    total_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    pending_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    data_type = Column(String(32))
    source_type = Column(String(32))
    
    records = relationship("ProcessedRecord", back_populates="batch")

class ProcessedRecord(Base):
    __tablename__ = "processed_records"
    
    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    record_type = Column(String(32))
    status = Column(String(32))
    phone = Column(String(32), index=True)
    id_card = Column(String(32), index=True)
    name = Column(String(64))
    activity_name = Column(String(255))
    activity_session = Column(String(128))
    original_data = Column(Text)
    error_message = Column(Text)
    suggestion = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    batch = relationship("Batch", back_populates="records")

class Registration(Base):
    __tablename__ = "registrations"
    
    id = Column(Integer, primary_key=True, index=True)
    phone = Column(String(32), index=True)
    id_card = Column(String(32), index=True)
    name = Column(String(64))
    activity_name = Column(String(255), index=True)
    activity_session = Column(String(128))
    register_time = Column(DateTime(timezone=True))
    status = Column(String(32), default="registered")
    source_batch = Column(String(64))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    __table_args__ = (
        UniqueConstraint('phone', 'activity_name', 'activity_session', name='_phone_activity_session_uc'),
    )

class Waitlist(Base):
    __tablename__ = "waitlists"
    
    id = Column(Integer, primary_key=True, index=True)
    phone = Column(String(32), index=True)
    id_card = Column(String(32))
    name = Column(String(64))
    activity_name = Column(String(255), index=True)
    activity_session = Column(String(128))
    priority = Column(Integer, default=0)
    wait_time = Column(DateTime(timezone=True))
    status = Column(String(32), default="waiting")
    source_batch = Column(String(64))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Checkin(Base):
    __tablename__ = "checkins"
    
    id = Column(Integer, primary_key=True, index=True)
    phone = Column(String(32), index=True)
    name = Column(String(64))
    activity_name = Column(String(255), index=True)
    activity_session = Column(String(128))
    checkin_time = Column(DateTime(timezone=True))
    status = Column(String(32), default="checked_in")
    source_batch = Column(String(64))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Blacklist(Base):
    __tablename__ = "blacklists"
    
    id = Column(Integer, primary_key=True, index=True)
    phone = Column(String(32), unique=True, index=True)
    id_card = Column(String(32), unique=True, index=True)
    name = Column(String(64))
    reason = Column(String(255))
    blacklist_time = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)
