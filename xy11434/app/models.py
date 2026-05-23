from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean, ForeignKey, Enum, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from app.database import Base


class RoleEnum(str, enum.Enum):
    ENTRY = "entry"
    REVIEWER = "reviewer"
    SUPERVISOR = "supervisor"
    READONLY = "readonly"
    SECRETARY = "secretary"


class WorkflowStatus(str, enum.Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    REJECTED = "rejected"
    SECOND_CONFIRM = "second_confirm"
    APPROVED = "approved"
    AUDITED = "audited"


class RecordType(str, enum.Enum):
    MATERIAL_REQUEST = "material_request"
    PURCHASE_ARRIVAL = "purchase_arrival"
    TEACHER_SIGN = "teacher_sign"
    INVENTORY_DIFF = "inventory_diff"
    REFUND = "refund"
    GROUP_BORROW = "group_borrow"
    LOSS = "loss"


class DirtyType(str, enum.Enum):
    MISSING_FIELD = "missing_field"
    CROSS_DAY = "cross_day"
    NAME_CHANGE = "name_change"
    AMOUNT_CONFLICT = "amount_conflict"
    QUANTITY_CONFLICT = "quantity_conflict"
    DUPLICATE = "duplicate"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    real_name = Column(String(50), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(RoleEnum), nullable=False)
    department = Column(String(100))
    phone = Column(String(20))
    email = Column(String(100))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    created_records = relationship("ConsumableRecord", back_populates="creator", foreign_keys="ConsumableRecord.created_by")
    reviewed_records = relationship("ConsumableRecord", back_populates="reviewer", foreign_keys="ConsumableRecord.reviewed_by")
    audit_logs = relationship("AuditLog", back_populates="user")


class ConsumableRecord(Base):
    __tablename__ = "consumable_records"

    id = Column(Integer, primary_key=True, index=True)
    record_no = Column(String(50), unique=True, index=True)
    record_type = Column(Enum(RecordType), nullable=False, index=True)

    title = Column(String(200), nullable=False)
    department = Column(String(100), index=True)
    research_group = Column(String(100), index=True)
    teacher_name = Column(String(50), index=True)

    material_name = Column(String(200))
    specification = Column(String(100))
    quantity = Column(Float)
    unit = Column(String(20))
    unit_price = Column(Float)
    total_amount = Column(Float)

    supplier = Column(String(200))
    purchase_order_no = Column(String(50))
    invoice_no = Column(String(50))

    request_date = Column(DateTime)
    arrival_date = Column(DateTime)
    sign_date = Column(DateTime)
    inventory_date = Column(DateTime)

    borrower = Column(String(50))
    expected_return_date = Column(DateTime)
    actual_return_date = Column(DateTime)

    loss_reason = Column(Text)
    refund_reason = Column(Text)
    refund_amount = Column(Float)

    status = Column(Enum(WorkflowStatus), default=WorkflowStatus.DRAFT, index=True)
    version = Column(Integer, default=1)
    is_dirty = Column(Boolean, default=False, index=True)

    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    reviewed_by = Column(Integer, ForeignKey("users.id"))
    reviewed_at = Column(DateTime(timezone=True))
    second_confirmed_by = Column(Integer, ForeignKey("users.id"))
    second_confirmed_at = Column(DateTime(timezone=True))
    approved_by = Column(Integer, ForeignKey("users.id"))
    approved_at = Column(DateTime(timezone=True))

    reject_reason = Column(Text)
    remarks = Column(Text)
    extra_data = Column(JSON)

    creator = relationship("User", back_populates="created_records", foreign_keys=[created_by])
    reviewer = relationship("User", back_populates="reviewed_records", foreign_keys=[reviewed_by])
    workflow_logs = relationship("WorkflowLog", back_populates="record")
    dirty_records = relationship("DirtyRecord", back_populates="original_record")
    attachments = relationship("Attachment", back_populates="record")


class DirtyRecord(Base):
    __tablename__ = "dirty_records"

    id = Column(Integer, primary_key=True, index=True)
    original_record_id = Column(Integer, ForeignKey("consumable_records.id"))
    dirty_type = Column(Enum(DirtyType), nullable=False, index=True)

    field_name = Column(String(100))
    original_value = Column(Text)
    expected_value = Column(Text)
    conflict_description = Column(Text)

    original_content = Column(JSON)
    processing_opinion = Column(Text)
    is_resolved = Column(Boolean, default=False, index=True)
    resolved_by = Column(Integer, ForeignKey("users.id"))
    resolved_at = Column(DateTime(timezone=True))

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    original_record = relationship("ConsumableRecord", back_populates="dirty_records")


class WorkflowLog(Base):
    __tablename__ = "workflow_logs"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(Integer, ForeignKey("consumable_records.id"))
    action = Column(String(50), nullable=False)
    from_status = Column(Enum(WorkflowStatus))
    to_status = Column(Enum(WorkflowStatus))

    operator_id = Column(Integer, ForeignKey("users.id"))
    operator_name = Column(String(50))
    operator_role = Column(Enum(RoleEnum))

    remarks = Column(Text)
    change_reason = Column(Text)
    changed_fields = Column(JSON)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    record = relationship("ConsumableRecord", back_populates="workflow_logs")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    username = Column(String(50))
    real_name = Column(String(50))
    role = Column(Enum(RoleEnum))

    action = Column(String(100), nullable=False, index=True)
    resource_type = Column(String(50), index=True)
    resource_id = Column(Integer)

    ip_address = Column(String(50))
    user_agent = Column(String(255))

    request_params = Column(JSON)
    response_data = Column(JSON)
    is_sensitive = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="audit_logs")


class Attachment(Base):
    __tablename__ = "attachments"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(Integer, ForeignKey("consumable_records.id"))
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer)
    file_type = Column(String(50))
    uploaded_by = Column(Integer, ForeignKey("users.id"))
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

    record = relationship("ConsumableRecord", back_populates="attachments")


class ImportBatch(Base):
    __tablename__ = "import_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String(50), unique=True, index=True)
    file_name = Column(String(255))
    record_type = Column(Enum(RecordType))
    total_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    dirty_count = Column(Integer, default=0)
    duplicate_count = Column(Integer, default=0)

    imported_by = Column(Integer, ForeignKey("users.id"))
    imported_at = Column(DateTime(timezone=True), server_default=func.now())

    remarks = Column(Text)
