from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Text, Enum, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
import enum

from .database import Base


class ImportSourceType(str, enum.Enum):
    ROOM_STATUS = "room_status"
    CLEANING_RECORD = "cleaning_record"
    PHOTO_LIST = "photo_list"


class RecordStatus(str, enum.Enum):
    PENDING = "pending"
    VALID = "valid"
    INVALID = "invalid"
    REVIEWED = "reviewed"


class IssueType(str, enum.Enum):
    COMPLAINT = "complaint"
    REWORK = "rework"
    PHOTO_MISSING = "photo_missing"


class DeductionStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    APPEALED = "appealed"
    RESOLVED = "resolved"


class RoomStatus(Base):
    __tablename__ = "room_statuses"

    id = Column(Integer, primary_key=True, index=True)
    room_number = Column(String, index=True, nullable=False)
    date = Column(DateTime, index=True, nullable=False)
    status = Column(String, nullable=False)
    guest_name = Column(String)
    check_in = Column(DateTime)
    check_out = Column(DateTime)
    source_file = Column(String)
    source_row = Column(Integer)
    status_record = Column(String, default=RecordStatus.PENDING)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

    cleaning_records = relationship("CleaningRecord", back_populates="room_status")


class Cleaner(Base):
    __tablename__ = "cleaners"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    phone = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())

    cleaning_records = relationship("CleaningRecord", back_populates="cleaner")


class CleaningRecord(Base):
    __tablename__ = "cleaning_records"

    id = Column(Integer, primary_key=True, index=True)
    room_status_id = Column(Integer, ForeignKey("room_statuses.id"))
    cleaner_id = Column(Integer, ForeignKey("cleaners.id"))
    room_number = Column(String, index=True, nullable=False)
    cleaning_date = Column(DateTime, index=True, nullable=False)
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    duration_minutes = Column(Integer)
    score = Column(Float)
    notes = Column(Text)
    source_file = Column(String)
    source_row = Column(Integer)
    status_record = Column(String, default=RecordStatus.PENDING)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

    room_status = relationship("RoomStatus", back_populates="cleaning_records")
    cleaner = relationship("Cleaner", back_populates="cleaning_records")
    photos = relationship("Photo", back_populates="cleaning_record")
    issues = relationship("Issue", back_populates="cleaning_record")


class Photo(Base):
    __tablename__ = "photos"

    id = Column(Integer, primary_key=True, index=True)
    cleaning_record_id = Column(Integer, ForeignKey("cleaning_records.id"))
    file_name = Column(String, nullable=False)
    file_path = Column(String)
    photo_type = Column(String)
    uploaded_at = Column(DateTime)
    is_valid = Column(Boolean, default=True)
    source_file = Column(String)
    source_row = Column(Integer)
    created_at = Column(DateTime, server_default=func.now())

    cleaning_record = relationship("CleaningRecord", back_populates="photos")


class Issue(Base):
    __tablename__ = "issues"

    id = Column(Integer, primary_key=True, index=True)
    cleaning_record_id = Column(Integer, ForeignKey("cleaning_records.id"))
    issue_type = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    reported_at = Column(DateTime, default=datetime.utcnow)
    reported_by = Column(String)
    deduction_amount = Column(Float, default=0.0)
    deduction_status = Column(String, default=DeductionStatus.PENDING)
    reviewer = Column(String)
    reviewed_at = Column(DateTime)
    resolution_notes = Column(Text)
    source_file = Column(String)
    source_row = Column(Integer)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

    cleaning_record = relationship("CleaningRecord", back_populates="issues")
    reworks = relationship("Rework", back_populates="issue")


class Rework(Base):
    __tablename__ = "reworks"

    id = Column(Integer, primary_key=True, index=True)
    issue_id = Column(Integer, ForeignKey("issues.id"))
    cleaner_id = Column(Integer, ForeignKey("cleaners.id"))
    rework_date = Column(DateTime, nullable=False)
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    notes = Column(Text)
    is_completed = Column(Boolean, default=False)
    verified_by = Column(String)
    verified_at = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())

    issue = relationship("Issue", back_populates="reworks")


class ImportError(Base):
    __tablename__ = "import_errors"

    id = Column(Integer, primary_key=True, index=True)
    source_type = Column(String, nullable=False)
    source_file = Column(String, nullable=False)
    source_row = Column(Integer)
    raw_data = Column(JSON)
    error_message = Column(Text, nullable=False)
    suggested_fix = Column(Text)
    is_resolved = Column(Boolean, default=False)
    resolved_by = Column(String)
    resolved_at = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    action = Column(String, nullable=False)
    entity_type = Column(String)
    entity_id = Column(Integer)
    old_value = Column(JSON)
    new_value = Column(JSON)
    operator = Column(String)
    created_at = Column(DateTime, server_default=func.now())


class Settlement(Base):
    __tablename__ = "settlements"

    id = Column(Integer, primary_key=True, index=True)
    cleaner_id = Column(Integer, ForeignKey("cleaners.id"))
    month = Column(String, index=True, nullable=False)
    total_cleanings = Column(Integer, default=0)
    base_amount = Column(Float, default=0.0)
    total_deductions = Column(Float, default=0.0)
    final_amount = Column(Float, default=0.0)
    is_finalized = Column(Boolean, default=False)
    finalized_by = Column(String)
    finalized_at = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
