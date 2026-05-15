from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, Enum, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.database import Base


class TaskStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    PARTIAL_SUCCESS = "partial_success"
    FAILED = "failed"
    EARLY_TERMINATED = "early_terminated"


class RiskType(str, enum.Enum):
    SECURITY = "security"
    DATA_INTEGRITY = "data_integrity"
    NETWORK = "network"
    DEVICE_HEALTH = "device_health"
    CONFIGURATION = "configuration"
    UNKNOWN = "unknown"


class EdgeNode(Base):
    __tablename__ = "edge_nodes"

    id = Column(Integer, primary_key=True, index=True)
    node_id = Column(String, unique=True, index=True)
    node_name = Column(String)
    ip_address = Column(String)
    location = Column(String)
    responsibility_team = Column(String)
    status = Column(String, default="active")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    iot_receipts = relationship("IoTReceipt", back_populates="edge_node")


class TaskBatch(Base):
    __tablename__ = "task_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String, unique=True, index=True)
    batch_name = Column(String)
    operator = Column(String)
    status = Column(Enum(TaskStatus), default=TaskStatus.PENDING)
    total_tasks = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    risk_type = Column(Enum(RiskType), default=RiskType.UNKNOWN)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))
    remarks = Column(Text)

    task_results = relationship("TaskResult", back_populates="batch")
    attribution_results = relationship("AttributionResult", back_populates="batch")


class TaskResult(Base):
    __tablename__ = "task_results"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(String, unique=True, index=True)
    batch_id = Column(String, ForeignKey("task_batches.batch_id"))
    node_id = Column(String)
    status = Column(Enum(TaskStatus), default=TaskStatus.PENDING)
    is_early_terminated = Column(Boolean, default=False)
    error_code = Column(String)
    error_message = Column(Text)
    executed_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))
    raw_output = Column(Text)

    batch = relationship("TaskBatch", back_populates="task_results")
    attribution_result = relationship("AttributionResult", back_populates="task_result", uselist=False)


class AttributionRule(Base):
    __tablename__ = "attribution_rules"

    id = Column(Integer, primary_key=True, index=True)
    rule_code = Column(String, unique=True, index=True)
    rule_name = Column(String)
    description = Column(Text)
    condition_pattern = Column(String)
    risk_type = Column(Enum(RiskType), default=RiskType.UNKNOWN)
    is_active = Column(Boolean, default=True)
    priority = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class AttributionResult(Base):
    __tablename__ = "attribution_results"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(String, ForeignKey("task_results.task_id"))
    batch_id = Column(String, ForeignKey("task_batches.batch_id"))
    blocked_by_rule = Column(String)
    blocked_by_rule_code = Column(String)
    block_reason = Column(Text)
    risk_type = Column(Enum(RiskType), default=RiskType.UNKNOWN)
    confidence_score = Column(Float, default=0.0)
    is_manual_modified = Column(Boolean, default=False)
    modified_by = Column(String)
    modified_at = Column(DateTime(timezone=True))
    original_conclusion = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    task_result = relationship("TaskResult", back_populates="attribution_result")
    batch = relationship("TaskBatch", back_populates="attribution_results")


class IoTReceipt(Base):
    __tablename__ = "iot_receipts"

    id = Column(Integer, primary_key=True, index=True)
    receipt_id = Column(String, unique=True, index=True)
    node_id = Column(String, ForeignKey("edge_nodes.node_id"))
    task_id = Column(String)
    receipt_type = Column(String)
    raw_data = Column(Text)
    received_at = Column(DateTime(timezone=True), server_default=func.now())
    responsibility_team = Column(String)

    edge_node = relationship("EdgeNode", back_populates="iot_receipts")


class RollbackCandidate(Base):
    __tablename__ = "rollback_candidates"

    id = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(String, unique=True, index=True)
    batch_id = Column(String)
    task_ids = Column(Text)
    reason = Column(Text)
    risk_level = Column(String)
    is_approved = Column(Boolean, default=False)
    approved_by = Column(String)
    approved_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(String)
