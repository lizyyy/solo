from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, JSON, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base
import enum
from sqlalchemy import Enum


class FieldChangeType(enum.Enum):
    ADD = "add"
    REMOVE = "remove"
    MODIFY = "modify"
    RENAME = "rename"


class FieldType(enum.Enum):
    STRING = "string"
    INTEGER = "integer"
    BIGINT = "bigint"
    FLOAT = "float"
    DOUBLE = "double"
    BOOLEAN = "boolean"
    DATE = "date"
    TIMESTAMP = "timestamp"
    ARRAY = "array"
    MAP = "map"
    STRUCT = "struct"


class ChangeStatus(enum.Enum):
    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    APPLIED = "applied"
    ROLLED_BACK = "rolled_back"
    CANCELLED = "cancelled"


class AlertStatus(enum.Enum):
    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"
    ACKNOWLEDGED = "acknowledged"


class TableMetadata(Base):
    __tablename__ = "table_metadata"

    id = Column(Integer, primary_key=True, index=True)
    database_name = Column(String(255), nullable=False, index=True)
    schema_name = Column(String(255), nullable=False, index=True)
    table_name = Column(String(255), nullable=False, index=True)
    current_version = Column(Integer, default=1)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    versions = relationship("TableFieldVersion", back_populates="table", cascade="all, delete-orphan")
    lineage_edges = relationship("LineageEdge", back_populates="source_table", foreign_keys="LineageEdge.source_table_id")
    subscriptions = relationship("Subscription", back_populates="table")


class TableFieldVersion(Base):
    __tablename__ = "table_field_version"

    id = Column(Integer, primary_key=True, index=True)
    table_id = Column(Integer, ForeignKey("table_metadata.id"), nullable=False, index=True)
    version = Column(Integer, nullable=False)
    fields = Column(JSON, nullable=False)
    change_log = Column(JSON, nullable=True)
    change_reason = Column(Text, nullable=True)
    created_by = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)
    hash_value = Column(String(64), nullable=False, index=True)

    table = relationship("TableMetadata", back_populates="versions")
    change_requests = relationship("FieldChangeRequest", back_populates="target_version")


class LineageEdge(Base):
    __tablename__ = "lineage_edge"

    id = Column(Integer, primary_key=True, index=True)
    source_table_id = Column(Integer, ForeignKey("table_metadata.id"), nullable=False, index=True)
    source_field_name = Column(String(255), nullable=True)
    target_table_id = Column(Integer, ForeignKey("table_metadata.id"), nullable=False, index=True)
    target_field_name = Column(String(255), nullable=True)
    transformation_logic = Column(Text, nullable=True)
    job_id = Column(String(255), nullable=True, index=True)
    job_name = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    source_table = relationship("TableMetadata", foreign_keys=[source_table_id])
    target_table = relationship("TableMetadata", foreign_keys=[target_table_id])


class FieldChangeRequest(Base):
    __tablename__ = "field_change_request"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(String(64), unique=True, nullable=False, index=True)
    table_id = Column(Integer, ForeignKey("table_metadata.id"), nullable=False, index=True)
    target_version_id = Column(Integer, ForeignKey("table_field_version.id"), nullable=True)
    change_type = Column(Enum(FieldChangeType), nullable=False)
    field_name = Column(String(255), nullable=False)
    old_value = Column(JSON, nullable=True)
    new_value = Column(JSON, nullable=True)
    reason = Column(Text, nullable=True)
    status = Column(Enum(ChangeStatus), default=ChangeStatus.DRAFT)
    created_by = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    approved_by = Column(String(255), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    applied_at = Column(DateTime(timezone=True), nullable=True)
    rollback_reason = Column(Text, nullable=True)
    rollback_by = Column(String(255), nullable=True)
    rollback_at = Column(DateTime(timezone=True), nullable=True)

    target_version = relationship("TableFieldVersion", back_populates="change_requests")
    impact_analyses = relationship("ImpactAnalysis", back_populates="change_request")
    alerts = relationship("Alert", back_populates="change_request")


class ImpactAnalysis(Base):
    __tablename__ = "impact_analysis"

    id = Column(Integer, primary_key=True, index=True)
    change_request_id = Column(Integer, ForeignKey("field_change_request.id"), nullable=False, index=True)
    analysis_id = Column(String(64), unique=True, nullable=False, index=True)
    analysis_type = Column(String(50), nullable=False)
    impacted_tables = Column(JSON, nullable=False)
    impacted_jobs = Column(JSON, nullable=True)
    impacted_metrics = Column(JSON, nullable=True)
    risk_level = Column(String(20), nullable=False)
    summary = Column(Text, nullable=True)
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    change_request = relationship("FieldChangeRequest", back_populates="impact_analyses")
    reports = relationship("ImpactReport", back_populates="analysis")


class ImpactReport(Base):
    __tablename__ = "impact_report"

    id = Column(Integer, primary_key=True, index=True)
    analysis_id = Column(Integer, ForeignKey("impact_analysis.id"), nullable=False, index=True)
    report_id = Column(String(64), unique=True, nullable=False, index=True)
    report_type = Column(String(50), nullable=False)
    content = Column(JSON, nullable=False)
    generated_at = Column(DateTime(timezone=True), server_default=func.now())
    generated_by = Column(String(255), nullable=True)

    analysis = relationship("ImpactAnalysis", back_populates="reports")


class Subscription(Base):
    __tablename__ = "subscription"

    id = Column(Integer, primary_key=True, index=True)
    table_id = Column(Integer, ForeignKey("table_metadata.id"), nullable=False, index=True)
    subscriber_id = Column(String(255), nullable=False, index=True)
    subscriber_name = Column(String(255), nullable=True)
    subscriber_email = Column(String(255), nullable=True)
    notification_channel = Column(String(50), default="email")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    table = relationship("TableMetadata", back_populates="subscriptions")


class Alert(Base):
    __tablename__ = "alert"

    id = Column(Integer, primary_key=True, index=True)
    alert_id = Column(String(64), unique=True, nullable=False, index=True)
    change_request_id = Column(Integer, ForeignKey("field_change_request.id"), nullable=False, index=True)
    subscriber_id = Column(String(255), nullable=True)
    alert_type = Column(String(50), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    status = Column(Enum(AlertStatus), default=AlertStatus.PENDING)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    sent_at = Column(DateTime(timezone=True), nullable=True)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    acknowledged_by = Column(String(255), nullable=True)

    change_request = relationship("FieldChangeRequest", back_populates="alerts")


class OperationHistory(Base):
    __tablename__ = "operation_history"

    id = Column(Integer, primary_key=True, index=True)
    operation_type = Column(String(50), nullable=False, index=True)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(Integer, nullable=False, index=True)
    entity_key = Column(String(255), nullable=True)
    old_state = Column(JSON, nullable=True)
    new_state = Column(JSON, nullable=True)
    operation_by = Column(String(255), nullable=True)
    operation_at = Column(DateTime(timezone=True), server_default=func.now())
    batch_id = Column(String(64), nullable=True, index=True)
    comment = Column(Text, nullable=True)


class MetricDefinition(Base):
    __tablename__ = "metric_definition"

    id = Column(Integer, primary_key=True, index=True)
    metric_id = Column(String(64), unique=True, nullable=False, index=True)
    metric_name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    owner = Column(String(255), nullable=True)
    calculation_logic = Column(Text, nullable=False)
    source_tables = Column(JSON, nullable=False)
    source_fields = Column(JSON, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
