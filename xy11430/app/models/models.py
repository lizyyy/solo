from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, Boolean, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from app.core.database import Base


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    COLLEGE_SECRETARY = "college_secretary"
    TEACHER = "teacher"
    SUPPLIER = "supplier"
    AUDITOR = "auditor"


class ReceiptStatus(str, enum.Enum):
    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    FROZEN = "frozen"
    SETTLED = "settled"
    ARCHIVED = "archived"


class AbnormalType(str, enum.Enum):
    BORROW = "borrow"
    LOSS = "loss"
    DAMAGE = "damage"
    EXPIRED = "expired"
    MISMATCH = "mismatch"
    OTHER = "other"


class DataSource(str, enum.Enum):
    REQUISITION = "requisition"
    PURCHASE_ARRIVAL = "purchase_arrival"
    TEACHER_SIGN = "teacher_sign"
    SUPPLIER_STATEMENT = "supplier_statement"
    MANUAL = "manual"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, index=True, nullable=False)
    real_name = Column(String(100), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False)
    college = Column(String(200))
    email = Column(String(200))
    phone = Column(String(50))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Batch(Base):
    __tablename__ = "batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String(100), unique=True, index=True, nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    college = Column(String(200), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"))
    status = Column(String(50), default="active")
    is_frozen = Column(Boolean, default=False)
    frozen_by = Column(Integer, ForeignKey("users.id"))
    frozen_at = Column(DateTime(timezone=True))
    frozen_reason = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    creator = relationship("User", foreign_keys=[created_by])
    freezer = relationship("User", foreign_keys=[frozen_by])


class Requisition(Base):
    __tablename__ = "requisitions"

    id = Column(Integer, primary_key=True, index=True)
    requisition_no = Column(String(100), unique=True, index=True, nullable=False)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    college = Column(String(200), nullable=False)
    lab_name = Column(String(200))
    teacher_name = Column(String(200))
    material_name = Column(String(200), nullable=False)
    material_code = Column(String(100))
    specification = Column(String(200))
    quantity = Column(Float, nullable=False)
    unit = Column(String(50))
    unit_price = Column(Float)
    total_amount = Column(Float)
    requisition_date = Column(DateTime(timezone=True))
    purpose = Column(Text)
    is_abnormal = Column(Boolean, default=False)
    abnormal_type = Column(Enum(AbnormalType))
    abnormal_reason = Column(Text)
    source = Column(Enum(DataSource), default=DataSource.REQUISITION)
    idempotent_key = Column(String(255), unique=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    batch = relationship("Batch")


class PurchaseArrival(Base):
    __tablename__ = "purchase_arrivals"

    id = Column(Integer, primary_key=True, index=True)
    arrival_no = Column(String(100), unique=True, index=True, nullable=False)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    college = Column(String(200), nullable=False)
    supplier_name = Column(String(200))
    material_name = Column(String(200), nullable=False)
    material_code = Column(String(100))
    specification = Column(String(200))
    ordered_quantity = Column(Float)
    arrived_quantity = Column(Float, nullable=False)
    unit = Column(String(50))
    unit_price = Column(Float)
    total_amount = Column(Float)
    arrival_date = Column(DateTime(timezone=True))
    quality_status = Column(String(100))
    is_abnormal = Column(Boolean, default=False)
    abnormal_type = Column(Enum(AbnormalType))
    abnormal_reason = Column(Text)
    source = Column(Enum(DataSource), default=DataSource.PURCHASE_ARRIVAL)
    idempotent_key = Column(String(255), unique=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    batch = relationship("Batch")


class TeacherSign(Base):
    __tablename__ = "teacher_signs"

    id = Column(Integer, primary_key=True, index=True)
    sign_no = Column(String(100), unique=True, index=True, nullable=False)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    college = Column(String(200), nullable=False)
    teacher_name = Column(String(200), nullable=False)
    lab_name = Column(String(200))
    material_name = Column(String(200), nullable=False)
    material_code = Column(String(100))
    specification = Column(String(200))
    quantity = Column(Float, nullable=False)
    unit = Column(String(50))
    sign_date = Column(DateTime(timezone=True))
    original_requisition_no = Column(String(100))
    is_abnormal = Column(Boolean, default=False)
    abnormal_type = Column(Enum(AbnormalType))
    abnormal_reason = Column(Text)
    source = Column(Enum(DataSource), default=DataSource.TEACHER_SIGN)
    idempotent_key = Column(String(255), unique=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    batch = relationship("Batch")


class SupplierStatement(Base):
    __tablename__ = "supplier_statements"

    id = Column(Integer, primary_key=True, index=True)
    statement_no = Column(String(100), unique=True, index=True, nullable=False)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    college = Column(String(200), nullable=False)
    supplier_name = Column(String(200), nullable=False)
    material_name = Column(String(200), nullable=False)
    material_code = Column(String(100))
    specification = Column(String(200))
    statement_quantity = Column(Float, nullable=False)
    actual_quantity = Column(Float)
    unit = Column(String(50))
    unit_price = Column(Float)
    total_amount = Column(Float)
    statement_date = Column(DateTime(timezone=True))
    is_abnormal = Column(Boolean, default=False)
    abnormal_type = Column(Enum(AbnormalType))
    abnormal_reason = Column(Text)
    source = Column(Enum(DataSource), default=DataSource.SUPPLIER_STATEMENT)
    idempotent_key = Column(String(255), unique=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    batch = relationship("Batch")


class AbnormalReceipt(Base):
    __tablename__ = "abnormal_receipts"

    id = Column(Integer, primary_key=True, index=True)
    receipt_no = Column(String(100), unique=True, index=True, nullable=False)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    college = Column(String(200), nullable=False)
    abnormal_type = Column(Enum(AbnormalType), nullable=False)
    source_type = Column(Enum(DataSource), nullable=False)
    source_id = Column(Integer)
    source_no = Column(String(100))
    material_name = Column(String(200), nullable=False)
    material_code = Column(String(100))
    specification = Column(String(200))
    quantity = Column(Float, nullable=False)
    unit = Column(String(50))
    unit_price = Column(Float)
    total_amount = Column(Float)
    lab_name = Column(String(200))
    teacher_name = Column(String(200))
    supplier_name = Column(String(200))
    abnormal_reason = Column(Text)
    manual_reason = Column(Text)
    status = Column(Enum(ReceiptStatus), default=ReceiptStatus.DRAFT)
    previous_status = Column(Enum(ReceiptStatus))
    created_by = Column(Integer, ForeignKey("users.id"))
    reviewed_by = Column(Integer, ForeignKey("users.id"))
    reviewed_at = Column(DateTime(timezone=True))
    review_comment = Column(Text)
    frozen_before_status = Column(Enum(ReceiptStatus))
    is_archived = Column(Boolean, default=False)
    approval_email_content = Column(Text)
    idempotent_key = Column(String(255), unique=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    batch = relationship("Batch")
    creator = relationship("User", foreign_keys=[created_by])
    reviewer = relationship("User", foreign_keys=[reviewed_by])


class StatusHistory(Base):
    __tablename__ = "status_histories"

    id = Column(Integer, primary_key=True, index=True)
    receipt_id = Column(Integer, ForeignKey("abnormal_receipts.id"), nullable=False)
    from_status = Column(Enum(ReceiptStatus))
    to_status = Column(Enum(ReceiptStatus), nullable=False)
    changed_by = Column(Integer, ForeignKey("users.id"))
    change_reason = Column(Text)
    manual_reason = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    receipt = relationship("AbnormalReceipt")
    changer = relationship("User")


class Attachment(Base):
    __tablename__ = "attachments"

    id = Column(Integer, primary_key=True, index=True)
    receipt_id = Column(Integer, ForeignKey("abnormal_receipts.id"))
    batch_id = Column(Integer, ForeignKey("batches.id"))
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer)
    file_type = Column(String(100))
    uploaded_by = Column(Integer, ForeignKey("users.id"))
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    receipt = relationship("AbnormalReceipt")
    batch = relationship("Batch")
    uploader = relationship("User")


class FailedRecord(Base):
    __tablename__ = "failed_records"

    id = Column(Integer, primary_key=True, index=True)
    source_type = Column(Enum(DataSource), nullable=False)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    raw_data = Column(Text, nullable=False)
    error_message = Column(Text, nullable=False)
    error_type = Column(String(200))
    idempotent_key = Column(String(255), index=True)
    retry_count = Column(Integer, default=0)
    resolved = Column(Boolean, default=False)
    resolved_by = Column(Integer, ForeignKey("users.id"))
    resolved_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    batch = relationship("Batch")
    resolver = relationship("User")
