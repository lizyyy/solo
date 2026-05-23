from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Enum, Float, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum


class UserRole(str, enum.Enum):
    DATA_ENTRY = "data_entry"
    REVIEWER = "reviewer"
    SUPERVISOR = "supervisor"
    READ_ONLY = "read_only"


class RecordSource(str, enum.Enum):
    ORDER_CALENDAR = "order_calendar"
    CLEANING_GROUP = "cleaning_group"
    MAINTENANCE_NOTE = "maintenance_note"
    MANUAL_PRICE = "manual_price"


class RecordStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    SUCCESS = "success"
    FAILED = "failed"
    RETRYING = "retrying"
    MANUAL_REVIEW = "manual_review"
    COMPENSATED = "compensated"
    CLOSED = "closed"
    DEAD_LETTER = "dead_letter"


class RetryCategory(str, enum.Enum):
    ROOM_CONFLICT = "room_conflict"
    LINEN_CHANGE = "linen_change"
    TEMP_CHECKOUT = "temp_checkout"
    DATA_MISMATCH = "data_mismatch"
    SYSTEM_ERROR = "system_error"
    OTHER = "other"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False)
    full_name = Column(String(100))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CleaningRecord(Base):
    __tablename__ = "cleaning_records"

    id = Column(Integer, primary_key=True, index=True)
    record_no = Column(String(50), unique=True, index=True)
    source = Column(Enum(RecordSource), nullable=False)
    source_id = Column(String(100))
    room_no = Column(String(20))
    guest_name = Column(String(100))
    checkin_date = Column(DateTime)
    checkout_date = Column(DateTime)
    cleaning_type = Column(String(50))
    linen_change = Column(Boolean, default=False)
    is_continuous_stay = Column(Boolean, default=False)
    temp_checkout = Column(Boolean, default=False)
    price = Column(Float)
    content = Column(Text)
    status = Column(Enum(RecordStatus), default=RecordStatus.PENDING)
    retry_category = Column(Enum(RetryCategory))
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=5)
    last_error = Column(Text)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    reviewed_by = Column(Integer, ForeignKey("users.id"))
    reviewed_at = Column(DateTime(timezone=True))
    review_comment = Column(Text)
    raw_data = Column(Text)
    is_valid = Column(Boolean, default=True)
    validation_errors = Column(Text)

    creator = relationship("User", foreign_keys=[created_by], backref="created_records")
    reviewer = relationship("User", foreign_keys=[reviewed_by], backref="reviewed_records")


class RetryQueue(Base):
    __tablename__ = "retry_queue"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(Integer, ForeignKey("cleaning_records.id"), nullable=False)
    retry_number = Column(Integer, default=1)
    scheduled_at = Column(DateTime(timezone=True), nullable=False)
    executed_at = Column(DateTime(timezone=True))
    status = Column(Enum(RecordStatus), default=RecordStatus.PENDING)
    error_message = Column(Text)
    result = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    record = relationship("CleaningRecord", backref="retries")


class OperationLog(Base):
    __tablename__ = "operation_logs"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(Integer, ForeignKey("cleaning_records.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    action = Column(String(50), nullable=False)
    old_status = Column(Enum(RecordStatus))
    new_status = Column(Enum(RecordStatus))
    comment = Column(Text)
    ip_address = Column(String(50))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    record = relationship("CleaningRecord", backref="operations")
    user = relationship("User", backref="operations")


class Compensation(Base):
    __tablename__ = "compensations"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(Integer, ForeignKey("cleaning_records.id"), nullable=False)
    amount = Column(Float, nullable=False)
    reason = Column(Text)
    processed_by = Column(Integer, ForeignKey("users.id"))
    status = Column(String(20), default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    processed_at = Column(DateTime(timezone=True))

    record = relationship("CleaningRecord", backref="compensations")
    processor = relationship("User", backref="processed_compensations")
