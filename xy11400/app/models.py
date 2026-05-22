from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Float, Boolean, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from app.database import Base


class UserRole(str, enum.Enum):
    DATA_ENTRY = "data_entry"
    REVIEWER = "reviewer"
    SUPERVISOR = "supervisor"
    READ_ONLY = "read_only"


class BatchStatus(str, enum.Enum):
    CREATED = "created"
    ATTACHMENTS_UPLOADED = "attachments_uploaded"
    UNDER_REVIEW = "under_review"
    REVIEWED = "reviewed"
    FROZEN = "frozen"
    ARCHIVED = "archived"
    REVERTED = "reverted"


class DirtyRecordType(str, enum.Enum):
    MISSING_FIELDS = "missing_fields"
    CROSS_DAY = "cross_day"
    BOX_RENAMED = "box_renamed"
    AMOUNT_CONFLICT = "amount_conflict"
    QUANTITY_CONFLICT = "quantity_conflict"


class AttachmentType(str, enum.Enum):
    DRIVER_PHOTO = "driver_photo"
    WMS_BOX_TABLE = "wms_box_table"
    TEMPERATURE_LOG = "temperature_log"
    SUPERVISOR_NOTE = "supervisor_note"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.READ_ONLY)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    status_transitions = relationship("StatusTransition", back_populates="operator")
    notes = relationship("SupervisorNote", back_populates="author")


class Batch(Base):
    __tablename__ = "batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String, unique=True, index=True, nullable=False)
    transport_order_no = Column(String, index=True)
    origin = Column(String)
    destination = Column(String)
    departure_date = Column(DateTime)
    arrival_date = Column(DateTime)
    total_boxes = Column(Integer)
    total_amount = Column(Float)
    current_status = Column(Enum(BatchStatus), nullable=False, default=BatchStatus.CREATED)
    status_before_frozen = Column(Enum(BatchStatus))
    frozen_reason = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    status_history = relationship("StatusTransition", back_populates="batch", order_by="StatusTransition.id")
    attachments = relationship("Attachment", back_populates="batch")
    dirty_records = relationship("DirtyRecord", back_populates="batch")
    box_items = relationship("BoxItem", back_populates="batch")
    notes = relationship("SupervisorNote", back_populates="batch")


class StatusTransition(Base):
    __tablename__ = "status_transitions"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    from_status = Column(Enum(BatchStatus))
    to_status = Column(Enum(BatchStatus), nullable=False)
    transition_time = Column(DateTime(timezone=True), server_default=func.now())
    operator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    reason = Column(Text, nullable=False)

    batch = relationship("Batch", back_populates="status_history")
    operator = relationship("User", back_populates="status_transitions")


class Attachment(Base):
    __tablename__ = "attachments"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    file_type = Column(Enum(AttachmentType), nullable=False)
    file_name = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_size = Column(Integer)
    upload_time = Column(DateTime(timezone=True), server_default=func.now())
    uploader_id = Column(Integer, ForeignKey("users.id"))
    description = Column(Text)

    batch = relationship("Batch", back_populates="attachments")


class BoxItem(Base):
    __tablename__ = "box_items"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    box_no = Column(String, index=True, nullable=False)
    original_box_no = Column(String)
    product_name = Column(String)
    quantity = Column(Integer)
    unit_price = Column(Float)
    amount = Column(Float)
    temperature_min = Column(Float)
    temperature_max = Column(Float)
    temperature_avg = Column(Float)
    is_abnormal = Column(Boolean, default=False)
    remark = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    batch = relationship("Batch", back_populates="box_items")


class DirtyRecord(Base):
    __tablename__ = "dirty_records"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    record_type = Column(Enum(DirtyRecordType), nullable=False)
    source_data = Column(Text, nullable=False)
    missing_fields = Column(String)
    cross_day_info = Column(Text)
    old_box_no = Column(String)
    new_box_no = Column(String)
    conflict_field = Column(String)
    old_value = Column(String)
    new_value = Column(String)
    handling_suggestion = Column(Text)
    is_resolved = Column(Boolean, default=False)
    resolved_by = Column(Integer, ForeignKey("users.id"))
    resolved_at = Column(DateTime(timezone=True))
    resolution_note = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    batch = relationship("Batch", back_populates="dirty_records")


class SupervisorNote(Base):
    __tablename__ = "supervisor_notes"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    is_approval = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    batch = relationship("Batch", back_populates="notes")
    author = relationship("User", back_populates="notes")
