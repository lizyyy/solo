from sqlalchemy import Column, Integer, String, DateTime, Text, Float, ForeignKey, Boolean, LargeBinary
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime

from pharmacy_expiry_tracker.db.database import Base
from pharmacy_expiry_tracker.models.enums import (
    RecordStatus,
    UserRole,
    ChangeType,
    ImportSourceType,
    LiabilityResult
)


class ImportSource(Base):
    __tablename__ = "import_sources"

    id = Column(Integer, primary_key=True, index=True)
    source_type = Column(String, nullable=False)
    file_name = Column(String, nullable=False)
    file_hash = Column(String, index=True)
    file_content = Column(LargeBinary)
    file_size = Column(Integer)
    uploaded_by = Column(String, nullable=False)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    total_rows = Column(Integer, default=0)
    success_rows = Column(Integer, default=0)
    failed_rows = Column(Integer, default=0)
    is_complete = Column(Boolean, default=False)
    notes = Column(Text)

    raw_records = relationship("ImportRawRecord", back_populates="import_source")
    expiry_records = relationship("ExpiryRecord", back_populates="import_source")


class ImportRawRecord(Base):
    __tablename__ = "import_raw_records"

    id = Column(Integer, primary_key=True, index=True)
    import_source_id = Column(Integer, ForeignKey("import_sources.id"))
    row_number = Column(Integer, nullable=False)
    raw_data = Column(Text, nullable=False)
    parsed_success = Column(Boolean, default=False)
    error_message = Column(Text)

    import_source = relationship("ImportSource", back_populates="raw_records")
    expiry_record = relationship("ExpiryRecord", back_populates="raw_record", uselist=False)


class ExpiryRecord(Base):
    __tablename__ = "expiry_records"

    id = Column(Integer, primary_key=True, index=True)
    record_no = Column(String, unique=True, index=True, nullable=False)
    import_source_id = Column(Integer, ForeignKey("import_sources.id"))
    raw_record_id = Column(Integer, ForeignKey("import_raw_records.id"))

    pharmacy_code = Column(String, index=True, nullable=False)
    pharmacy_name = Column(String, nullable=False)
    region = Column(String, index=True)
    town = Column(String, index=True)

    drug_code = Column(String, index=True, nullable=False)
    drug_name = Column(String, nullable=False)
    drug_spec = Column(String)
    batch_no = Column(String, index=True, nullable=False)
    expiry_date = Column(DateTime, nullable=False)
    quantity = Column(Integer, nullable=False)
    unit = Column(String)

    days_near_expiry = Column(Integer)
    expiry_category = Column(String)

    liability_result = Column(String, default=LiabilityResult.PENDING.value)
    liability_amount = Column(Float, default=0.0)

    status = Column(String, default=RecordStatus.DRAFT.value)
    is_frozen = Column(Boolean, default=False)
    frozen_at = Column(DateTime)
    frozen_by = Column(String)

    created_by = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_by = Column(String)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    current_version = Column(Integer, default=1)

    remarks = Column(Text)
    change_reason = Column(Text)

    import_source = relationship("ImportSource", back_populates="expiry_records")
    raw_record = relationship("ImportRawRecord", back_populates="expiry_record")
    evidences = relationship("Evidence", back_populates="expiry_record")
    change_logs = relationship("ChangeLog", back_populates="expiry_record")
    revisions = relationship("RecordRevision", back_populates="expiry_record")


class Evidence(Base):
    __tablename__ = "evidences"

    id = Column(Integer, primary_key=True, index=True)
    expiry_record_id = Column(Integer, ForeignKey("expiry_records.id"))
    evidence_type = Column(String, nullable=False)
    file_name = Column(String, nullable=False)
    file_path = Column(String)
    file_hash = Column(String)
    file_content = Column(LargeBinary)
    description = Column(Text)
    uploaded_by = Column(String, nullable=False)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    is_original = Column(Boolean, default=True)

    expiry_record = relationship("ExpiryRecord", back_populates="evidences")


class ChangeLog(Base):
    __tablename__ = "change_logs"

    id = Column(Integer, primary_key=True, index=True)
    expiry_record_id = Column(Integer, ForeignKey("expiry_records.id"))
    change_type = Column(String, nullable=False)
    old_status = Column(String)
    new_status = Column(String)
    old_values = Column(Text)
    new_values = Column(Text)
    change_reason = Column(Text)
    changed_by = Column(String, nullable=False)
    changed_at = Column(DateTime(timezone=True), server_default=func.now())
    user_role = Column(String)
    ip_address = Column(String)

    expiry_record = relationship("ExpiryRecord", back_populates="change_logs")


class RecordRevision(Base):
    __tablename__ = "record_revisions"

    id = Column(Integer, primary_key=True, index=True)
    expiry_record_id = Column(Integer, ForeignKey("expiry_records.id"))
    version = Column(Integer, nullable=False)
    snapshot_data = Column(Text, nullable=False)
    created_by = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    change_reason = Column(Text)

    expiry_record = relationship("ExpiryRecord", back_populates="revisions")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    role = Column(String, nullable=False)
    region = Column(String)
    town = Column(String)
    pharmacy_code = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    hashed_password = Column(String)


class ExportAuditLog(Base):
    __tablename__ = "export_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    export_id = Column(String, unique=True, index=True, nullable=False)
    exported_by = Column(String, nullable=False)
    user_role = Column(String)
    exported_at = Column(DateTime(timezone=True), server_default=func.now())
    record_count = Column(Integer, default=0)
    is_masked = Column(Boolean, default=True)
    filters_applied = Column(Text)
    file_name = Column(String)
    file_hash = Column(String)
