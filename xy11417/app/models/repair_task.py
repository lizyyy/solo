from sqlalchemy import Column, Integer, String, DateTime, Text, JSON, ForeignKey, Boolean, Float
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.core.config import TaskStatus, RetryCategory, SourceType

class SourceData(Base):
    __tablename__ = "source_data"
    
    id = Column(Integer, primary_key=True, index=True)
    source_type = Column(String(50), nullable=False)
    source_id = Column(String(100), index=True, nullable=False)
    resident_id = Column(String(50), index=True)
    resident_name = Column(String(100))
    room_number = Column(String(50))
    repair_type = Column(String(100))
    repair_content = Column(Text)
    submit_time = Column(DateTime)
    technician_id = Column(String(50))
    technician_name = Column(String(100))
    material_used = Column(JSON)
    material_cost = Column(Float)
    work_hours = Column(Float)
    completion_status = Column(String(50))
    receipt_number = Column(String(100))
    screenshot_urls = Column(JSON)
    supplementary_reason = Column(Text)
    original_order_id = Column(String(100), index=True)
    raw_data = Column(JSON)
    data_hash = Column(String(64), index=True)
    is_valid = Column(Boolean, default=True)
    validation_errors = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(Integer, ForeignKey("users.id"))
    
    repair_tasks = relationship("RepairTask", back_populates="source_data")

class RepairTask(Base):
    __tablename__ = "repair_tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(String(100), unique=True, index=True, nullable=False)
    source_data_id = Column(Integer, ForeignKey("source_data.id"))
    order_id = Column(String(100), index=True)
    status = Column(String(30), default=TaskStatus.PENDING.value, nullable=False)
    retry_category = Column(String(50))
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=5)
    next_retry_at = Column(DateTime(timezone=True))
    last_retry_at = Column(DateTime(timezone=True))
    error_message = Column(Text)
    error_stack = Column(Text)
    is_repair = Column(Boolean, default=False)
    is_part_replacement = Column(Boolean, default=False)
    parent_task_id = Column(String(100), index=True)
    merge_with_task_id = Column(String(100))
    compensation_amount = Column(Float, default=0.0)
    compensation_reason = Column(Text)
    compensated_at = Column(DateTime(timezone=True))
    compensated_by = Column(Integer, ForeignKey("users.id"))
    closed_at = Column(DateTime(timezone=True))
    closed_by = Column(Integer, ForeignKey("users.id"))
    manual_review_required = Column(Boolean, default=False)
    manual_reviewed_by = Column(Integer, ForeignKey("users.id"))
    manual_reviewed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    source_data = relationship("SourceData", back_populates="repair_tasks")
    process_logs = relationship("ProcessLog", back_populates="task")
    failed_records = relationship("FailedRecord", back_populates="task")
    compensations = relationship("Compensation", back_populates="task")

class ProcessLog(Base):
    __tablename__ = "process_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(String(100), ForeignKey("repair_tasks.task_id"), nullable=False)
    action = Column(String(100), nullable=False)
    status_before = Column(String(30))
    status_after = Column(String(30))
    details = Column(JSON)
    performed_by = Column(Integer, ForeignKey("users.id"))
    performed_at = Column(DateTime(timezone=True), server_default=func.now())
    ip_address = Column(String(50))
    
    task = relationship("RepairTask", back_populates="process_logs")

class FailedRecord(Base):
    __tablename__ = "failed_records"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(String(100), ForeignKey("repair_tasks.task_id"), nullable=False)
    retry_attempt = Column(Integer)
    error_category = Column(String(50))
    error_message = Column(Text)
    error_details = Column(JSON)
    raw_payload = Column(JSON)
    is_resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime(timezone=True))
    resolved_by = Column(Integer, ForeignKey("users.id"))
    resolution_notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    task = relationship("RepairTask", back_populates="failed_records")

class Compensation(Base):
    __tablename__ = "compensations"
    
    id = Column(Integer, primary_key=True, index=True)
    compensation_id = Column(String(100), unique=True, index=True, nullable=False)
    task_id = Column(String(100), ForeignKey("repair_tasks.task_id"), nullable=False)
    amount = Column(Float, nullable=False)
    reason = Column(Text)
    compensation_type = Column(String(50))
    status = Column(String(30), default="pending")
    approved_by = Column(Integer, ForeignKey("users.id"))
    approved_at = Column(DateTime(timezone=True))
    disbursed_at = Column(DateTime(timezone=True))
    transaction_id = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    task = relationship("RepairTask", back_populates="compensations")
