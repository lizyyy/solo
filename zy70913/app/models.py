from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum


class BatchStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class GrievanceStatus(str, enum.Enum):
    APPROVED = "approved"
    PENDING = "pending"
    REJECTED = "rejected"


class RuleLevel(str, enum.Enum):
    A = "A"
    B = "B"
    C = "C"


class Batch(Base):
    __tablename__ = "batches"
    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String(50), unique=True, index=True, nullable=False)
    file_hash = Column(String(32), unique=True, index=True)
    file_name = Column(String(255))
    status = Column(Enum(BatchStatus), default=BatchStatus.PENDING)
    total_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    fail_count = Column(Integer, default=0)
    pending_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    grievances = relationship("Grievance", back_populates="batch")
    processing_histories = relationship("ProcessingHistory", back_populates="batch")

class Grievance(Base):
    __tablename__ = "grievances"
    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    grievance_no = Column(String(100), unique=True, index=True, nullable=False)
    passenger_name = Column(String(100))
    passenger_id = Column(String(50))
    flight_no = Column(String(50))
    flight_date = Column(DateTime)
    incident_type = Column(String(100))
    incident_desc = Column(Text)
    apply_amount = Column(Float, default=0.0)
    apply_time = Column(DateTime)
    status = Column(Enum(GrievanceStatus), default=GrievanceStatus.PENDING)
    final_amount = Column(Float, default=0.0)
    rule_level = Column(Enum(RuleLevel))
    photo_count = Column(Integer, default=0)
    has_photo_evidence = Column(Boolean, default=False)
    is_overdue = Column(Boolean, default=False)
    is_responsible = Column(Boolean, default=False)
    original_data = Column(Text)
    remark = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    batch = relationship("Batch", back_populates="grievances")
    flights = relationship("Flight", back_populates="grievance")
    photo_indices = relationship("PhotoIndex", back_populates="grievance")
    processing_histories = relationship("ProcessingHistory", back_populates="grievance")

class Flight(Base):
    __tablename__ = "flights"
    id = Column(Integer, primary_key=True, index=True)
    grievance_id = Column(Integer, ForeignKey("grievances.id"))
    flight_no = Column(String(50))
    flight_date = Column(DateTime)
    departure = Column(String(100))
    arrival = Column(String(100))
    scheduled_departure = Column(DateTime)
    actual_departure = Column(DateTime)
    scheduled_arrival = Column(DateTime)
    actual_arrival = Column(DateTime)
    airline = Column(String(100))
    is_responsible = Column(Boolean, default=False)
    delay_minutes = Column(Integer, default=0)
    cancel_reason = Column(String(255))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    grievance = relationship("Grievance", back_populates="flights")

class PhotoIndex(Base):
    __tablename__ = "photo_indices"
    id = Column(Integer, primary_key=True, index=True)
    grievance_id = Column(Integer, ForeignKey("grievances.id"))
    photo_path = Column(String(500))
    photo_hash = Column(String(64))
    photo_type = Column(String(50))
    is_valid = Column(Boolean, default=True)
    ocr_text = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    grievance = relationship("Grievance", back_populates="photo_indices")

class ProcessingHistory(Base):
    __tablename__ = "processing_histories"
    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    grievance_id = Column(Integer, ForeignKey("grievances.id"))
    action = Column(String(100))
    rule_name = Column(String(100))
    rule_result = Column(Boolean)
    detail = Column(Text)
    operator = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    batch = relationship("Batch", back_populates="processing_histories")
    grievance = relationship("Grievance", back_populates="processing_histories")

class CompensationRule(Base):
    __tablename__ = "compensation_rules"
    id = Column(Integer, primary_key=True, index=True)
    rule_code = Column(String(50), unique=True, index=True)
    rule_name = Column(String(200))
    rule_level = Column(Enum(RuleLevel))
    max_amount = Column(Float, default=0.0)
    min_amount = Column(Float, default=0.0)
    incident_type = Column(String(100))
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
