from datetime import datetime
from enum import Enum as PyEnum
from sqlalchemy import (
    Column, Integer, String, Float, DateTime, Text, Boolean,
    ForeignKey, Enum, JSON
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

Base = declarative_base()


class Role(PyEnum):
    DATA_ENTRY = "data_entry"
    REVIEWER = "reviewer"
    SUPERVISOR = "supervisor"
    READ_ONLY = "read_only"


class DataSource(PyEnum):
    WMS_CSV = "wms_csv"
    TEMPERATURE_LOG = "temperature_log"
    SHIFT_RECORD = "shift_record"
    DRIVER_PHOTO = "driver_photo"
    MANUAL_ENTRY = "manual_entry"


class IssueType(PyEnum):
    MISSING_FIELD = "missing_field"
    CROSS_DAY_SIGN = "cross_day_sign"
    BOX_RENAME = "box_rename"
    AMOUNT_CONFLICT = "amount_conflict"
    QUANTITY_CONFLICT = "quantity_conflict"
    DUPLICATE_IMPORT = "duplicate_import"


class RecordStatus(PyEnum):
    PENDING = "pending"
    ISSUE_FOUND = "issue_found"
    FIXED = "fixed"
    APPROVED = "approved"
    REJECTED = "rejected"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    username = Column(String(50), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum(Role), nullable=False)
    created_at = Column(DateTime, default=datetime.now)
    last_login = Column(DateTime)

    operation_logs = relationship("OperationLog", back_populates="user")


class ImportBatch(Base):
    __tablename__ = "import_batches"

    id = Column(Integer, primary_key=True)
    batch_no = Column(String(50), unique=True, nullable=False)
    source = Column(Enum(DataSource), nullable=False)
    filename = Column(String(255))
    file_hash = Column(String(64))
    total_rows = Column(Integer, default=0)
    imported_by = Column(Integer, ForeignKey("users.id"))
    imported_at = Column(DateTime, default=datetime.now)
    status = Column(String(20), default="processing")
    notes = Column(Text)

    records = relationship("ColdChainRecord", back_populates="batch")


class ColdChainRecord(Base):
    __tablename__ = "cold_chain_records"

    id = Column(Integer, primary_key=True)
    batch_id = Column(Integer, ForeignKey("import_batches.id"))
    original_line_no = Column(Integer)
    source_type = Column(Enum(DataSource))
    
    box_no = Column(String(50))
    original_box_no = Column(String(50))
    driver_name = Column(String(50))
    vehicle_no = Column(String(20))
    departure = Column(String(100))
    destination = Column(String(100))
    
    shipment_date = Column(DateTime)
    receive_date = Column(DateTime)
    expected_date = Column(DateTime)
    cross_day = Column(Boolean, default=False)
    
    quantity = Column(Integer)
    original_quantity = Column(Integer)
    unit_price = Column(Float)
    amount = Column(Float)
    original_amount = Column(Float)
    
    min_temp = Column(Float)
    max_temp = Column(Float)
    avg_temp = Column(Float)
    temp_exceed_count = Column(Integer, default=0)
    
    shift_no = Column(String(50))
    photo_ref = Column(String(255))
    signatory = Column(String(50))
    
    raw_data = Column(JSON)
    status = Column(Enum(RecordStatus), default=RecordStatus.PENDING)
    
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    batch = relationship("ImportBatch", back_populates="records")
    issues = relationship("RecordIssue", back_populates="record")
    fix_history = relationship("FixHistory", back_populates="record")


class RecordIssue(Base):
    __tablename__ = "record_issues"

    id = Column(Integer, primary_key=True)
    record_id = Column(Integer, ForeignKey("cold_chain_records.id"))
    issue_type = Column(Enum(IssueType), nullable=False)
    field_name = Column(String(100))
    description = Column(Text)
    old_value = Column(Text)
    new_value = Column(Text)
    confidence = Column(Float)
    detected_at = Column(DateTime, default=datetime.now)
    resolved = Column(Boolean, default=False)
    resolved_by = Column(Integer, ForeignKey("users.id"))
    resolved_at = Column(DateTime)

    record = relationship("ColdChainRecord", back_populates="issues")


class FixHistory(Base):
    __tablename__ = "fix_history"

    id = Column(Integer, primary_key=True)
    record_id = Column(Integer, ForeignKey("cold_chain_records.id"))
    field_name = Column(String(100))
    old_value = Column(Text)
    new_value = Column(Text)
    fix_reason = Column(Text)
    operator_id = Column(Integer, ForeignKey("users.id"))
    operator_role = Column(Enum(Role))
    created_at = Column(DateTime, default=datetime.now)
    reimported = Column(Boolean, default=False)
    reimport_batch_id = Column(Integer, ForeignKey("import_batches.id"))

    record = relationship("ColdChainRecord", back_populates="fix_history")


class OperationLog(Base):
    __tablename__ = "operation_logs"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    action = Column(String(50), nullable=False)
    resource_type = Column(String(50))
    resource_id = Column(Integer)
    details = Column(JSON)
    ip_address = Column(String(50))
    created_at = Column(DateTime, default=datetime.now)

    user = relationship("User", back_populates="operation_logs")
