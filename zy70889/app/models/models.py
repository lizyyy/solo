from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, Float, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from app.core.database import Base


class DataSource(str, enum.Enum):
    APP = "app"
    WECHAT = "wechat"
    MANUAL = "manual"
    OTHER = "other"


class ProcessingStatus(str, enum.Enum):
    NORMAL = "normal"
    PENDING_CONFIRM = "pending_confirm"
    FAILED = "failed"


class RecordType(str, enum.Enum):
    CHECKIN = "checkin"
    LEAVE = "leave"
    LOCATION = "location"


class Batch(Base):
    __tablename__ = "batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_hash = Column(String(64), unique=True, index=True, nullable=False)
    record_type = Column(Enum(RecordType), nullable=False)
    source = Column(Enum(DataSource), default=DataSource.OTHER)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    total_records = Column(Integer, default=0)
    processed = Column(Boolean, default=False)

    results = relationship("ProcessingResult", back_populates="batch")


class CheckInRecord(Base):
    __tablename__ = "checkin_records"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(String(64), unique=True, index=True)
    person_id = Column(String(32), index=True, nullable=False)
    person_name = Column(String(64))
    checkin_time = Column(DateTime(timezone=True))
    scheduled_time = Column(DateTime(timezone=True))
    location = Column(String(255))
    source = Column(Enum(DataSource), default=DataSource.OTHER)
    raw_data = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class LeaveRecord(Base):
    __tablename__ = "leave_records"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(String(64), unique=True, index=True)
    person_id = Column(String(32), index=True, nullable=False)
    person_name = Column(String(64))
    start_time = Column(DateTime(timezone=True))
    end_time = Column(DateTime(timezone=True))
    reason = Column(String(255))
    status = Column(String(32), default="approved")
    source = Column(Enum(DataSource), default=DataSource.OTHER)
    raw_data = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class LocationSummary(Base):
    __tablename__ = "location_summaries"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(String(64), unique=True, index=True)
    person_id = Column(String(32), index=True, nullable=False)
    person_name = Column(String(64))
    date = Column(DateTime(timezone=True))
    total_points = Column(Integer, default=0)
    gap_count = Column(Integer, default=0)
    max_gap_minutes = Column(Float, default=0)
    out_of_bounds = Column(Boolean, default=False)
    source = Column(Enum(DataSource), default=DataSource.OTHER)
    raw_data = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ProcessingResult(Base):
    __tablename__ = "processing_results"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    record_type = Column(Enum(RecordType), nullable=False)
    person_id = Column(String(32), index=True)
    person_name = Column(String(64))
    status = Column(Enum(ProcessingStatus), nullable=False)
    rule_code = Column(String(32))
    rule_name = Column(String(64))
    suggestion = Column(Text)
    original_data = Column(Text)
    detail = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    batch = relationship("Batch", back_populates="results")
