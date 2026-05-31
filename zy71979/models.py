from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, ForeignKey, Boolean, JSON, Index
)
from sqlalchemy.orm import relationship, declarative_base
from sqlalchemy.sql import func

Base = declarative_base()


class QualityInspection(Base):
    __tablename__ = "quality_inspections"

    id = Column(Integer, primary_key=True, autoincrement=True)
    inspection_no = Column(String(64), unique=True, nullable=False, index=True)
    customer_id = Column(String(64), index=True)
    service_type = Column(String(32))
    inspector = Column(String(64))
    inspection_time = Column(DateTime, index=True)
    submit_time = Column(DateTime, default=func.now())
    is_late_submit = Column(Boolean, default=False)
    content = Column(JSON)
    raw_data = Column(JSON)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    dialogs = relationship("CustomerServiceDialog", back_populates="inspection")
    samples = relationship("ReviewSample", back_populates="inspection")


class CustomerServiceDialog(Base):
    __tablename__ = "customer_service_dialogs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    dialog_id = Column(String(64), unique=True, nullable=False, index=True)
    customer_id = Column(String(64), index=True)
    agent_id = Column(String(64))
    start_time = Column(DateTime, index=True)
    end_time = Column(DateTime)
    is_late_supplement = Column(Boolean, default=False)
    supplement_time = Column(DateTime)
    content = Column(JSON)
    raw_data = Column(JSON)
    inspection_id = Column(Integer, ForeignKey("quality_inspections.id"))
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    inspection = relationship("QualityInspection", back_populates="dialogs")
    samples = relationship("ReviewSample", back_populates="dialog")


class KnowledgeBaseEntry(Base):
    __tablename__ = "knowledge_base_entries"

    id = Column(Integer, primary_key=True, autoincrement=True)
    entry_id = Column(String(64), unique=True, nullable=False, index=True)
    title = Column(String(255))
    category = Column(String(64))
    version = Column(String(32))
    is_manual_modified = Column(Boolean, default=False)
    modified_time = Column(DateTime)
    modifier = Column(String(64))
    content = Column(JSON)
    raw_data = Column(JSON)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    samples = relationship("ReviewSample", back_populates="knowledge_entry")


class ReviewSample(Base):
    __tablename__ = "review_samples"

    id = Column(Integer, primary_key=True, autoincrement=True)
    sample_batch_no = Column(String(64), index=True)
    sample_date = Column(DateTime, index=True)
    sampler = Column(String(64))
    reviewer = Column(String(64))
    review_status = Column(String(32), default="pending")
    anomaly_type = Column(String(64))
    is_anomaly = Column(Boolean, default=False)
    conclusion = Column(Text)
    evidence_summary = Column(Text)
    inspection_id = Column(Integer, ForeignKey("quality_inspections.id"))
    dialog_id = Column(Integer, ForeignKey("customer_service_dialogs.id"))
    knowledge_entry_id = Column(Integer, ForeignKey("knowledge_base_entries.id"))
    filter_condition_id = Column(Integer, ForeignKey("filter_conditions.id"))
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    inspection = relationship("QualityInspection", back_populates="samples")
    dialog = relationship("CustomerServiceDialog", back_populates="samples")
    knowledge_entry = relationship("KnowledgeBaseEntry", back_populates="samples")
    filter_condition = relationship("FilterCondition", back_populates="samples")
    change_histories = relationship("ChangeHistory", back_populates="sample")

    __table_args__ = (
        Index("idx_sample_batch_date", "sample_batch_no", "sample_date"),
    )


class ChangeHistory(Base):
    __tablename__ = "change_histories"

    id = Column(Integer, primary_key=True, autoincrement=True)
    sample_id = Column(Integer, ForeignKey("review_samples.id"), nullable=False)
    change_type = Column(String(32), nullable=False, index=True)
    field_name = Column(String(64))
    old_value = Column(JSON)
    new_value = Column(JSON)
    operator = Column(String(64))
    operation_time = Column(DateTime, default=func.now(), index=True)
    remark = Column(Text)
    change_source = Column(String(32))
    version_hash = Column(String(64), index=True)

    sample = relationship("ReviewSample", back_populates="change_histories")


class FilterCondition(Base):
    __tablename__ = "filter_conditions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    condition_hash = Column(String(64), unique=True, nullable=False, index=True)
    conditions = Column(JSON, nullable=False)
    page = Column(Integer, default=1)
    page_size = Column(Integer, default=50)
    sort_by = Column(String(64))
    sort_order = Column(String(16), default="desc")
    total_count = Column(Integer, default=0)
    created_by = Column(String(64))
    created_at = Column(DateTime, default=func.now())
    last_used_at = Column(DateTime, default=func.now())

    samples = relationship("ReviewSample", back_populates="filter_condition")
    exports = relationship("ExportRecord", back_populates="filter_condition")


class BatchTask(Base):
    __tablename__ = "batch_tasks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    idempotency_key = Column(String(128), unique=True, nullable=False, index=True)
    task_name = Column(String(128), nullable=False)
    status = Column(String(32), default="pending", index=True)
    params = Column(JSON)
    result = Column(JSON)
    total_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    operator = Column(String(64))
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())


class ExportRecord(Base):
    __tablename__ = "export_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    export_no = Column(String(64), unique=True, nullable=False)
    export_type = Column(String(32), default="weekly_report")
    file_name = Column(String(255))
    file_path = Column(String(512))
    filter_condition_id = Column(Integer, ForeignKey("filter_conditions.id"))
    record_count = Column(Integer, default=0)
    exported_by = Column(String(64))
    exported_at = Column(DateTime, default=func.now())
    snapshot_hash = Column(String(64), index=True)

    filter_condition = relationship("FilterCondition", back_populates="exports")
