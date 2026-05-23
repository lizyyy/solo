import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Enum, Boolean
from sqlalchemy.orm import relationship
from .database import Base


class UserRole(str, enum.Enum):
    ENTRY = "entry"
    REVIEW = "review"
    SUPERVISOR = "supervisor"
    READONLY = "readonly"


class BatchStatus(str, enum.Enum):
    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    REVIEWED = "reviewed"
    FROZEN = "frozen"
    ARCHIVED = "archived"
    REJECTED = "rejected"


class RecordType(str, enum.Enum):
    DELIVERY_NOTE = "delivery_note"
    WEIGHING_RECORD = "weighing_record"
    RETURN_BASKET_PHOTO = "return_basket_photo"
    EXTERNAL_RECEIPT = "external_receipt"


class DirtyType(str, enum.Enum):
    MISSING_FIELD = "missing_field"
    CROSS_DATE = "cross_date"
    NAME_CHANGE = "name_change"
    AMOUNT_CONFLICT = "amount_conflict"
    QUANTITY_CONFLICT = "quantity_conflict"
    CLEAN = "clean"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(Enum(UserRole), default=UserRole.READONLY)
    created_at = Column(DateTime, default=datetime.utcnow)


class Batch(Base):
    __tablename__ = "batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String, unique=True, index=True)
    supplier_name = Column(String, index=True)
    delivery_date = Column(DateTime, index=True)
    status = Column(Enum(BatchStatus), default=BatchStatus.DRAFT)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    total_delivery_amount = Column(Float, default=0)
    total_weighing_amount = Column(Float, default=0)
    bad_fruit_deduction = Column(Float, default=0)
    secondary_sorting_loss = Column(Float, default=0)
    final_settlement = Column(Float, default=0)
    review_comment = Column(Text)
    freeze_reason = Column(Text)
    archive_reason = Column(Text)

    records = relationship("Record", back_populates="batch", cascade="all, delete-orphan")
    status_trails = relationship("StatusTrail", back_populates="batch", cascade="all, delete-orphan")


class Record(Base):
    __tablename__ = "records"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    record_type = Column(Enum(RecordType), index=True)
    external_ref_no = Column(String, index=True)
    raw_content = Column(Text)
    is_dirty = Column(Boolean, default=False)
    dirty_type = Column(Enum(DirtyType), default=DirtyType.CLEAN)
    dirty_note = Column(Text)
    is_processed = Column(Boolean, default=False)
    processing_note = Column(Text)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    product_name = Column(String)
    quantity = Column(Float)
    unit_price = Column(Float)
    amount = Column(Float)
    record_date = Column(DateTime)
    supplier_name_in_record = Column(String)

    batch = relationship("Batch", back_populates="records")
    attachments = relationship("Attachment", back_populates="record", cascade="all, delete-orphan")
    correction_trails = relationship("CorrectionTrail", back_populates="record", cascade="all, delete-orphan")


class Attachment(Base):
    __tablename__ = "attachments"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(Integer, ForeignKey("records.id"))
    file_name = Column(String)
    file_path = Column(String)
    file_type = Column(String)
    file_size = Column(Integer)
    uploaded_by = Column(Integer, ForeignKey("users.id"))
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    record = relationship("Record", back_populates="attachments")


class StatusTrail(Base):
    __tablename__ = "status_trails"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    from_status = Column(Enum(BatchStatus))
    to_status = Column(Enum(BatchStatus))
    changed_by = Column(Integer, ForeignKey("users.id"))
    changed_at = Column(DateTime, default=datetime.utcnow)
    reason = Column(Text)

    batch = relationship("Batch", back_populates="status_trails")


class CorrectionTrail(Base):
    __tablename__ = "correction_trails"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(Integer, ForeignKey("records.id"))
    field_name = Column(String)
    old_value = Column(Text)
    new_value = Column(Text)
    corrected_by = Column(Integer, ForeignKey("users.id"))
    corrected_at = Column(DateTime, default=datetime.utcnow)
    correction_note = Column(Text)

    record = relationship("Record", back_populates="correction_trails")
