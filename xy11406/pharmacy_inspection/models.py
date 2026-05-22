import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Enum, Date, Float, Boolean
from sqlalchemy.orm import relationship
from .database import Base

class DataSourceType(enum.Enum):
    INVENTORY = "inventory"
    TRANSFER = "transfer"
    RETURN_PHOTO = "return_photo"
    SUPPLIER_STATEMENT = "supplier_statement"

class ImportStrategy(enum.Enum):
    IGNORE = "ignore"
    OVERWRITE = "overwrite"
    APPEND = "append"

class TaskStatus(enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    WAITING_RETRY = "waiting_retry"
    WAITING_MANUAL = "waiting_manual"
    PERMANENT_FAILED = "permanent_failed"
    COMPLETED = "completed"

class OperationType(enum.Enum):
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    IMPORT = "import"
    CHECK = "check"
    FIX = "fix"
    EXPORT = "export"

class RecordStatus(enum.Enum):
    RAW = "raw"
    VALID = "valid"
    INVALID = "invalid"
    FIXED = "fixed"

class Batch(Base):
    __tablename__ = 'batches'
    
    id = Column(Integer, primary_key=True)
    batch_no = Column(String(50), unique=True, nullable=False)
    name = Column(String(200))
    source_type = Column(Enum(DataSourceType), nullable=False)
    strategy = Column(Enum(ImportStrategy), nullable=False)
    file_name = Column(String(500))
    pharmacy_name = Column(String(200))
    operator = Column(String(100), nullable=False)
    total_records = Column(Integer, default=0)
    valid_records = Column(Integer, default=0)
    invalid_records = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    remark = Column(Text)
    
    records = relationship("MedicineRecord", back_populates="batch")
    tasks = relationship("InspectionTask", back_populates="batch")

class MedicineRecord(Base):
    __tablename__ = 'medicine_records'
    
    id = Column(Integer, primary_key=True)
    batch_id = Column(Integer, ForeignKey('batches.id'), nullable=False)
    source_type = Column(Enum(DataSourceType), nullable=False)
    original_line_no = Column(Integer)
    original_hash = Column(String(64))
    
    medicine_code = Column(String(100))
    medicine_name = Column(String(200))
    specification = Column(String(200))
    manufacturer = Column(String(200))
    batch_number = Column(String(100))
    production_date = Column(Date)
    expiry_date = Column(Date)
    quantity = Column(Integer, default=0)
    unit = Column(String(50))
    purchase_price = Column(Float, default=0)
    selling_price = Column(Float, default=0)
    supplier = Column(String(200))
    warehouse = Column(String(200))
    
    status = Column(Enum(RecordStatus), default=RecordStatus.RAW)
    check_errors = Column(Text)
    is_fixed = Column(Boolean, default=False)
    fixed_by = Column(String(100))
    fixed_at = Column(DateTime)
    fix_note = Column(Text)
    
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    
    batch = relationship("Batch", back_populates="records")
    audit_logs = relationship("AuditLog", back_populates="record")

class InspectionTask(Base):
    __tablename__ = 'inspection_tasks'
    
    id = Column(Integer, primary_key=True)
    batch_id = Column(Integer, ForeignKey('batches.id'))
    task_type = Column(String(100), nullable=False)
    status = Column(Enum(TaskStatus), default=TaskStatus.PENDING)
    progress = Column(Integer, default=0)
    total = Column(Integer, default=0)
    error_message = Column(Text)
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    operator = Column(String(100))
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    result_summary = Column(Text)
    
    batch = relationship("Batch", back_populates="tasks")

class AuditLog(Base):
    __tablename__ = 'audit_logs'
    
    id = Column(Integer, primary_key=True)
    record_id = Column(Integer, ForeignKey('medicine_records.id'))
    batch_id = Column(Integer)
    operation_type = Column(Enum(OperationType), nullable=False)
    operator = Column(String(100), nullable=False)
    field_name = Column(String(100))
    old_value = Column(Text)
    new_value = Column(Text)
    change_reason = Column(Text)
    ip_address = Column(String(50))
    created_at = Column(DateTime, default=datetime.now)
    
    record = relationship("MedicineRecord", back_populates="audit_logs")
