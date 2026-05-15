from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON, Boolean, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum

class BatchStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    PARTIAL_SUCCESS = "partial_success"
    SUCCESS = "success"
    FAILED = "failed"
    APPROVAL_REQUIRED = "approval_required"

class ReplayStatus(str, enum.Enum):
    SUCCESS = "success"
    FAILED = "failed"
    BLOCKED = "blocked"
    APPROVED = "approved"
    REJECTED = "rejected"

class ApprovalAction(str, enum.Enum):
    APPROVE = "approve"
    REJECT = "reject"
    ESCALATE = "escalate"

class GatewayErrorExtract(Base):
    __tablename__ = "gateway_error_extracts"
    
    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    trace_id = Column(String, index=True)
    request_id = Column(String, index=True)
    error_code = Column(String, index=True)
    error_message = Column(Text)
    request_path = Column(String)
    request_method = Column(String)
    request_headers = Column(JSON)
    request_body = Column(JSON)
    response_status = Column(Integer)
    response_body = Column(JSON)
    timestamp = Column(DateTime)
    service_name = Column(String)
    upstream_service = Column(String)
    approval_opinion = Column(String)
    approval_status = Column(String)
    raw_data = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    batch = relationship("Batch", back_populates="error_extracts")
    replay_results = relationship("ReplayResult", back_populates="error_extract")

class Batch(Base):
    __tablename__ = "batches"
    
    id = Column(Integer, primary_key=True, index=True)
    batch_number = Column(String, unique=True, index=True)
    status = Column(String, default=BatchStatus.PENDING)
    rule_version_id = Column(Integer, ForeignKey("rule_versions.id"))
    total_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    blocked_count = Column(Integer, default=0)
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    execution_time_ms = Column(Float)
    created_by = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    rule_version = relationship("RuleVersion", back_populates="batches")
    error_extracts = relationship("GatewayErrorExtract", back_populates="batch")
    replay_results = relationship("ReplayResult", back_populates="batch")
    approval_records = relationship("ApprovalRecord", back_populates="batch")
    reports = relationship("Report", back_populates="batch")

class RuleVersion(Base):
    __tablename__ = "rule_versions"
    
    id = Column(Integer, primary_key=True, index=True)
    version = Column(String, unique=True, index=True)
    rule_name = Column(String)
    description = Column(Text)
    rules = Column(JSON)
    is_active = Column(Boolean, default=True)
    created_by = Column(String)
    effective_from = Column(DateTime(timezone=True), server_default=func.now())
    effective_to = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    batches = relationship("Batch", back_populates="rule_version")

class ReplayResult(Base):
    __tablename__ = "replay_results"
    
    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    error_extract_id = Column(Integer, ForeignKey("gateway_error_extracts.id"))
    status = Column(String)
    execution_time_ms = Column(Float)
    before_data = Column(JSON)
    after_data = Column(JSON)
    block_reason = Column(Text)
    block_code = Column(String)
    matched_rules = Column(JSON)
    approval_required = Column(Boolean, default=False)
    approval_opinion_missing = Column(Boolean, default=False)
    processed_at = Column(DateTime(timezone=True), server_default=func.now())
    
    batch = relationship("Batch", back_populates="replay_results")
    error_extract = relationship("GatewayErrorExtract", back_populates="replay_results")
    approval_records = relationship("ApprovalRecord", back_populates="replay_result")

class ApprovalRecord(Base):
    __tablename__ = "approval_records"
    
    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    replay_result_id = Column(Integer, ForeignKey("replay_results.id"))
    warehouse_handover_id = Column(Integer, ForeignKey("warehouse_handovers.id"))
    action = Column(String)
    comment = Column(Text)
    previous_status = Column(String)
    new_status = Column(String)
    approved_by = Column(String)
    responsibility_team = Column(String)
    approved_at = Column(DateTime(timezone=True), server_default=func.now())
    
    batch = relationship("Batch", back_populates="approval_records")
    replay_result = relationship("ReplayResult", back_populates="approval_records")
    warehouse_handover = relationship("WarehouseHandover", back_populates="approval_records")

class WarehouseHandover(Base):
    __tablename__ = "warehouse_handovers"
    
    id = Column(Integer, primary_key=True, index=True)
    handover_number = Column(String, unique=True, index=True)
    responsibility_team = Column(String)
    original_records = Column(JSON)
    handover_note = Column(Text)
    handed_by = Column(String)
    received_by = Column(String)
    handed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    approval_records = relationship("ApprovalRecord", back_populates="warehouse_handover")

class Report(Base):
    __tablename__ = "reports"
    
    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    report_type = Column(String)
    content = Column(JSON)
    before_summary = Column(JSON)
    after_summary = Column(JSON)
    execution_time_ms = Column(Float)
    next_steps = Column(JSON)
    generated_by = Column(String)
    generated_at = Column(DateTime(timezone=True), server_default=func.now())
    
    batch = relationship("Batch", back_populates="reports")
