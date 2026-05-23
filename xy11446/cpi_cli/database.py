import os
from datetime import datetime
from enum import Enum as PyEnum
from typing import Optional

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    create_engine,
    Enum,
    Boolean,
    JSON,
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

DB_PATH = os.path.expanduser("~/.cpi/cpi.db")
Base = declarative_base()


class DataSourceType(PyEnum):
    PILE_ALARM = "pile_alarm"
    INSPECTION = "inspection"
    COMPLAINT = "complaint"
    SUPPLIER_BILL = "supplier_bill"
    OFFLINE_WORK_ORDER = "offline_work_order"
    APPROVAL_EMAIL = "approval_email"


class ImportMode(PyEnum):
    IGNORE = "ignore"
    OVERWRITE = "overwrite"
    APPEND = "append"


class TaskStatus(PyEnum):
    PENDING = "pending"
    RUNNING = "running"
    WAIT_RETRY = "wait_retry"
    WAIT_MANUAL = "wait_manual"
    PERMANENT_FAIL = "permanent_fail"
    COMPLETED = "completed"


class ValidationLevel(PyEnum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"


class ImportBatch(Base):
    __tablename__ = "import_batches"

    id = Column(Integer, primary_key=True)
    batch_no = Column(String(50), unique=True, nullable=False)
    source_type = Column(Enum(DataSourceType), nullable=False)
    file_name = Column(String(255))
    import_mode = Column(Enum(ImportMode), nullable=False)
    imported_by = Column(String(100), default="system")
    imported_at = Column(DateTime, default=datetime.now)
    total_rows = Column(Integer, default=0)
    success_rows = Column(Integer, default=0)
    failed_rows = Column(Integer, default=0)
    status = Column(Enum(TaskStatus), default=TaskStatus.PENDING)
    remark = Column(Text)

    records = relationship("DataRecord", back_populates="batch")
    validations = relationship("ValidationError", back_populates="batch")
    history_entries = relationship("AuditHistory", back_populates="batch")


class DataRecord(Base):
    __tablename__ = "data_records"

    id = Column(Integer, primary_key=True)
    batch_id = Column(Integer, ForeignKey("import_batches.id"))
    source_type = Column(Enum(DataSourceType), nullable=False)
    source_row_no = Column(Integer)
    source_key = Column(String(200))
    is_valid = Column(Boolean, default=True)
    data = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    batch = relationship("ImportBatch", back_populates="records")
    validations = relationship("ValidationError", back_populates="record")
    history_entries = relationship("AuditHistory", back_populates="record")


class ValidationError(Base):
    __tablename__ = "validation_errors"

    id = Column(Integer, primary_key=True)
    batch_id = Column(Integer, ForeignKey("import_batches.id"))
    record_id = Column(Integer, ForeignKey("data_records.id"))
    source_row_no = Column(Integer)
    level = Column(Enum(ValidationLevel), nullable=False)
    field_name = Column(String(100))
    error_code = Column(String(100))
    error_message = Column(Text, nullable=False)
    fixed = Column(Boolean, default=False)
    fixed_by = Column(String(100))
    fixed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.now)

    batch = relationship("ImportBatch", back_populates="validations")
    record = relationship("DataRecord", back_populates="validations")


class AuditHistory(Base):
    __tablename__ = "audit_history"

    id = Column(Integer, primary_key=True)
    batch_id = Column(Integer, ForeignKey("import_batches.id"))
    record_id = Column(Integer, ForeignKey("data_records.id"))
    action = Column(String(50), nullable=False)
    field_name = Column(String(100))
    old_value = Column(Text)
    new_value = Column(Text)
    changed_by = Column(String(100), default="system")
    changed_at = Column(DateTime, default=datetime.now)
    source_row_no = Column(Integer)
    diff_data = Column(JSON)

    batch = relationship("ImportBatch", back_populates="history_entries")
    record = relationship("DataRecord", back_populates="history_entries")


class AsyncTask(Base):
    __tablename__ = "async_tasks"

    id = Column(Integer, primary_key=True)
    task_id = Column(String(100), unique=True, nullable=False)
    task_type = Column(String(50), nullable=False)
    batch_id = Column(Integer, ForeignKey("import_batches.id"))
    status = Column(Enum(TaskStatus), default=TaskStatus.PENDING)
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    error_message = Column(Text)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    completed_at = Column(DateTime)
    payload = Column(JSON)


def get_engine():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    return create_engine(f"sqlite:///{DB_PATH}", echo=False)


def get_session():
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    return Session()


def init_db():
    engine = get_engine()
    Base.metadata.create_all(engine)
