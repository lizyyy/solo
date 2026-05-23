from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, ForeignKey, JSON, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base
import enum


class UserRole(str, enum.Enum):
    OPERATOR = "operator"
    AUDITOR = "auditor"
    SECURITY_SUPERVISOR = "security_supervisor"
    ADMIN = "admin"


class LedgerStatus(str, enum.Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    REJECTED = "rejected"
    SECOND_CONFIRMATION = "second_confirmation"
    CONFIRMED = "confirmed"
    FROZEN = "frozen"
    ARCHIVED = "archived"


class DataSource(str, enum.Enum):
    VISITOR_APPOINTMENT = "visitor_appointment"
    GATE_RECORD = "gate_record"
    TEMP_PLATE_SCREENSHOT = "temp_plate_screenshot"
    HISTORICAL_ARCHIVE = "historical_archive"
    MANUAL_SUPPLEMENT = "manual_supplement"


class PermissionResult(str, enum.Enum):
    PENDING = "pending"
    PERMISSION_GRANTED = "permission_granted"
    PERMISSION_REVOKED = "permission_revoked"
    CROSS_DAY_ISSUE = "cross_day_issue"
    UNCERTAIN = "uncertain"
    MANUAL_JUDGMENT = "manual_judgment"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(UserRole), default=UserRole.OPERATOR)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    workflow_logs = relationship("WorkflowLog", back_populates="operator")


class OriginalEvidence(Base):
    __tablename__ = "original_evidences"

    id = Column(Integer, primary_key=True, index=True)
    ledger_id = Column(Integer, ForeignKey("visitor_ledgers.id"), nullable=False)
    source_type = Column(Enum(DataSource), nullable=False)
    source_file_name = Column(String, nullable=False)
    source_file_hash = Column(String)
    original_row_number = Column(Integer)
    raw_data = Column(JSON, nullable=False)
    parsed_data = Column(JSON)
    import_batch_id = Column(String, index=True)
    is_valid = Column(Boolean, default=True)
    validation_error = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    ledger = relationship("VisitorLedger", back_populates="evidences")


class VisitorLedger(Base):
    __tablename__ = "visitor_ledgers"

    id = Column(Integer, primary_key=True, index=True)
    ledger_no = Column(String, unique=True, index=True, nullable=False)
    visitor_name = Column(String)
    visitor_phone = Column(String)
    visitor_id_card = Column(String)
    visit_purpose = Column(String)
    visited_person = Column(String)
    visited_department = Column(String)
    temp_plate_number = Column(String)
    appointment_start_time = Column(DateTime(timezone=True))
    appointment_end_time = Column(DateTime(timezone=True))
    actual_entry_time = Column(DateTime(timezone=True))
    actual_exit_time = Column(DateTime(timezone=True))
    permission_granted_time = Column(DateTime(timezone=True))
    permission_revoked_time = Column(DateTime(timezone=True))
    is_cross_day = Column(Boolean, default=False)
    permission_result = Column(Enum(PermissionResult), default=PermissionResult.PENDING)
    status = Column(Enum(LedgerStatus), default=LedgerStatus.DRAFT)
    is_manual_judgment = Column(Boolean, default=False)
    judgment_reason = Column(Text)
    sensitive_fields_masked = Column(Boolean, default=False)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    evidences = relationship("OriginalEvidence", back_populates="ledger", cascade="all, delete-orphan")
    version_history = relationship("VersionHistory", back_populates="ledger", cascade="all, delete-orphan")
    workflow_logs = relationship("WorkflowLog", back_populates="ledger", cascade="all, delete-orphan")
    supplements = relationship("SupplementRecord", back_populates="ledger", cascade="all, delete-orphan")


class VersionHistory(Base):
    __tablename__ = "version_history"

    id = Column(Integer, primary_key=True, index=True)
    ledger_id = Column(Integer, ForeignKey("visitor_ledgers.id"), nullable=False)
    version_number = Column(Integer, nullable=False)
    action_type = Column(String, nullable=False)
    previous_state = Column(JSON)
    current_state = Column(JSON)
    diff_summary = Column(JSON)
    operator_id = Column(Integer, ForeignKey("users.id"))
    operator_name = Column(String)
    change_reason = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    ledger = relationship("VisitorLedger", back_populates="version_history")


class WorkflowLog(Base):
    __tablename__ = "workflow_logs"

    id = Column(Integer, primary_key=True, index=True)
    ledger_id = Column(Integer, ForeignKey("visitor_ledgers.id"), nullable=False)
    action = Column(String, nullable=False)
    from_status = Column(Enum(LedgerStatus))
    to_status = Column(Enum(LedgerStatus))
    operator_id = Column(Integer, ForeignKey("users.id"))
    operator_name = Column(String)
    operator_role = Column(String)
    comment = Column(Text)
    change_reason = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    ledger = relationship("VisitorLedger", back_populates="workflow_logs")
    operator = relationship("User", back_populates="workflow_logs")


class SupplementRecord(Base):
    __tablename__ = "supplement_records"

    id = Column(Integer, primary_key=True, index=True)
    ledger_id = Column(Integer, ForeignKey("visitor_ledgers.id"), nullable=False)
    supplement_type = Column(String, nullable=False)
    content = Column(JSON, nullable=False)
    supplementary_by = Column(Integer, ForeignKey("users.id"))
    supplementary_at = Column(DateTime(timezone=True), server_default=func.now())
    remark = Column(Text)

    ledger = relationship("VisitorLedger", back_populates="supplements")


class ImportBatch(Base):
    __tablename__ = "import_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String, unique=True, index=True, nullable=False)
    source_type = Column(Enum(DataSource), nullable=False)
    file_name = Column(String, nullable=False)
    file_hash = Column(String)
    total_rows = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    skipped_count = Column(Integer, default=0)
    status = Column(String, default="processing")
    error_log = Column(Text)
    imported_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))
