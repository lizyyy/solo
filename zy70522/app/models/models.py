from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, Boolean, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum


class RebalanceStatus(str, enum.Enum):
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXECUTING = "executing"
    COMPLETED = "completed"
    FAILED = "failed"
    NEEDS_CORRECTION = "needs_correction"


class ShardRebalancePlan(Base):
    __tablename__ = "shard_rebalance_plans"

    id = Column(Integer, primary_key=True, index=True)
    plan_no = Column(String, unique=True, index=True, nullable=False)
    source_shard = Column(String, nullable=False, index=True)
    target_node = Column(String, nullable=False)
    target_shard = Column(String, nullable=True)

    tenant_distribution = Column(JSON, nullable=False)
    migration_traffic_gb = Column(Float, nullable=False)
    estimated_duration_min = Column(Integer, nullable=False)
    hot_tenant_count = Column(Integer, default=0)
    hot_tenants = Column(JSON, nullable=True)

    risk_level = Column(String, nullable=False)
    risk_score = Column(Float, nullable=False)
    risk_details = Column(JSON, nullable=True)

    status = Column(String, default=RebalanceStatus.DRAFT.value)
    created_by = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    raw_input = Column(JSON, nullable=True)
    processing_logic = Column(Text, nullable=True)

    approvals = relationship("ApprovalRecord", back_populates="plan")
    executions = relationship("ExecutionSummary", back_populates="plan")
    corrections = relationship("ManualCorrection", back_populates="plan")
    failure_records = relationship("FailureRecord", back_populates="plan")


class ApprovalRecord(Base):
    __tablename__ = "approval_records"

    id = Column(Integer, primary_key=True, index=True)
    plan_id = Column(Integer, ForeignKey("shard_rebalance_plans.id"), nullable=False)
    approver = Column(String, nullable=False)
    approval_action = Column(String, nullable=False)
    comments = Column(Text, nullable=True)
    approved_at = Column(DateTime(timezone=True), server_default=func.now())

    plan = relationship("ShardRebalancePlan", back_populates="approvals")


class ExecutionSummary(Base):
    __tablename__ = "execution_summaries"

    id = Column(Integer, primary_key=True, index=True)
    plan_id = Column(Integer, ForeignKey("shard_rebalance_plans.id"), nullable=False)
    actual_start_time = Column(DateTime(timezone=True))
    actual_end_time = Column(DateTime(timezone=True))
    actual_traffic_gb = Column(Float)
    success = Column(Boolean)
    execution_details = Column(JSON)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    plan = relationship("ShardRebalancePlan", back_populates="executions")


class ManualCorrection(Base):
    __tablename__ = "manual_corrections"

    id = Column(Integer, primary_key=True, index=True)
    plan_id = Column(Integer, ForeignKey("shard_rebalance_plans.id"), nullable=False)
    corrected_by = Column(String, nullable=False)
    original_values = Column(JSON, nullable=False)
    corrected_values = Column(JSON, nullable=False)
    correction_reason = Column(Text, nullable=False)
    corrected_at = Column(DateTime(timezone=True), server_default=func.now())
    recalculated_plan = Column(JSON, nullable=True)

    plan = relationship("ShardRebalancePlan", back_populates="corrections")


class FailureRecord(Base):
    __tablename__ = "failure_records"

    id = Column(Integer, primary_key=True, index=True)
    plan_id = Column(Integer, ForeignKey("shard_rebalance_plans.id"), nullable=False)
    failed_step = Column(String, nullable=False)
    raw_input_snapshot = Column(JSON, nullable=False)
    processing_evidence = Column(JSON, nullable=False)
    final_conclusion = Column(Text, nullable=False)
    error_details = Column(Text, nullable=True)
    failed_at = Column(DateTime(timezone=True), server_default=func.now())

    plan = relationship("ShardRebalancePlan", back_populates="failure_records")
