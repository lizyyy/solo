import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.sqlite import JSON

from .database import Base


class BatchStatus(str, enum.Enum):
    PENDING = "pending"
    VALIDATING = "validating"
    VALIDATED = "validated"
    PROCESSING = "processing"
    PARTIAL_SUCCESS = "partial_success"
    SUCCESS = "success"
    FAILED = "failed"
    ROLLBACK_PLANNED = "rollback_planned"
    ROLLING_BACK = "rolling_back"
    ROLLED_BACK = "rolled_back"


class StageType(str, enum.Enum):
    VALIDATION = "validation"
    DATA_PREPARE = "data_prepare"
    WRITE_MAIN = "write_main"
    WRITE_RELATED = "write_related"
    POST_PROCESS = "post_process"
    NOTIFY = "notify"


class ImportBatch(Base):
    __tablename__ = "import_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String(64), unique=True, index=True, nullable=False)
    source_system = Column(String(64), nullable=False)
    import_type = Column(String(64), nullable=False)
    total_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    status = Column(String(32), default=BatchStatus.PENDING)
    current_stage = Column(String(32))
    request_idempotent_key = Column(String(128), unique=True, index=True)
    created_by = Column(String(64))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    extra_metadata = Column(JSON, default=dict)

    items = relationship("ImportItem", back_populates="batch")
    dependencies = relationship("BatchDependency", foreign_keys="BatchDependency.batch_id", back_populates="batch")
    stage_records = relationship("StageRecord", back_populates="batch")
    rollback_plan = relationship("RollbackPlan", back_populates="batch", uselist=False)


class ImportItem(Base):
    __tablename__ = "import_items"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("import_batches.id"))
    item_no = Column(String(64), index=True)
    item_type = Column(String(64))
    source_data = Column(JSON)
    target_id = Column(String(64))
    status = Column(String(32), default="pending")
    error_message = Column(Text)
    retry_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    batch = relationship("ImportBatch", back_populates="items")
    write_details = relationship("WriteDetail", back_populates="item")


class BatchDependency(Base):
    __tablename__ = "batch_dependencies"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("import_batches.id"))
    dependent_batch_id = Column(Integer, ForeignKey("import_batches.id"))
    dependency_type = Column(String(32))
    is_rollback_cascade = Column(Boolean, default=True)
    order = Column(Integer, default=0)

    batch = relationship("ImportBatch", foreign_keys=[batch_id], back_populates="dependencies")
    dependent_batch = relationship("ImportBatch", foreign_keys=[dependent_batch_id])


class StageRecord(Base):
    __tablename__ = "stage_records"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("import_batches.id"))
    stage = Column(String(32), nullable=False)
    status = Column(String(32), default="pending")
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    error_message = Column(Text)
    retry_count = Column(Integer, default=0)
    metrics = Column(JSON, default=dict)

    batch = relationship("ImportBatch", back_populates="stage_records")


class WriteDetail(Base):
    __tablename__ = "write_details"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("import_items.id"))
    table_name = Column(String(64))
    record_id = Column(String(64))
    operation_type = Column(String(32))
    before_data = Column(JSON)
    after_data = Column(JSON)
    written_at = Column(DateTime, default=datetime.utcnow)
    rollback_status = Column(String(32), default="pending")
    rollback_at = Column(DateTime)

    item = relationship("ImportItem", back_populates="write_details")


class RollbackPlan(Base):
    __tablename__ = "rollback_plans"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("import_batches.id"), unique=True)
    reason = Column(Text)
    planned_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String(32), default="pending")
    total_operations = Column(Integer, default=0)
    completed_operations = Column(Integer, default=0)
    failed_operations = Column(Integer, default=0)
    strategy = Column(String(32), default="reverse_order")

    batch = relationship("ImportBatch", back_populates="rollback_plan")
    items = relationship("RollbackItem", back_populates="plan")
    report = relationship("RollbackReport", back_populates="plan", uselist=False)


class RollbackItem(Base):
    __tablename__ = "rollback_items"

    id = Column(Integer, primary_key=True, index=True)
    plan_id = Column(Integer, ForeignKey("rollback_plans.id"))
    write_detail_id = Column(Integer, ForeignKey("write_details.id"))
    order = Column(Integer)
    status = Column(String(32), default="pending")
    error_message = Column(Text)
    executed_at = Column(DateTime)

    plan = relationship("RollbackPlan", back_populates="items")
    write_detail = relationship("WriteDetail")


class RollbackReport(Base):
    __tablename__ = "rollback_reports"

    id = Column(Integer, primary_key=True, index=True)
    plan_id = Column(Integer, ForeignKey("rollback_plans.id"), unique=True)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    status = Column(String(32))
    summary = Column(JSON)
    details = Column(JSON)
    generated_at = Column(DateTime, default=datetime.utcnow)

    plan = relationship("RollbackPlan", back_populates="report")
