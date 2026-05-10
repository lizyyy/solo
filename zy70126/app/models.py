from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Float, JSON, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
from enum import Enum
from app.database import Base


class ApprovalStatus(str, Enum):
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    REJECTED = "rejected"
    IN_TRANSIT = "in_transit"
    AT_DESTINATION = "at_destination"
    RETURNING = "returning"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    FAILED = "failed"


class TaskStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    RETRYING = "retrying"
    CANCELLED = "cancelled"


class OperationType(str, Enum):
    CREATE = "create"
    UPDATE = "update"
    SUBMIT = "submit"
    APPROVE = "approve"
    REJECT = "reject"
    ISSUE_INSURANCE = "issue_insurance"
    UPDATE_TRANSPORT = "update_transport"
    ENVIRONMENT_RECORD = "environment_record"
    RETURN_INSPECTION = "return_inspection"
    COMPLETE = "complete"
    CANCEL = "cancel"
    RETRY = "retry"
    ROLLBACK = "rollback"


class CollectionItem(Base):
    __tablename__ = "collection_items"
    
    id = Column(Integer, primary_key=True, index=True)
    item_code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(200), nullable=False)
    category = Column(String(100))
    era = Column(String(100))
    description = Column(Text)
    current_location = Column(String(200))
    condition = Column(String(200))
    value = Column(Float)
    is_available = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    approvals = relationship("OutboundApproval", back_populates="item")
    insurance_policies = relationship("InsurancePolicy", back_populates="item")


class OutboundApproval(Base):
    __tablename__ = "outbound_approvals"
    
    id = Column(Integer, primary_key=True, index=True)
    approval_no = Column(String(50), unique=True, index=True, nullable=False)
    item_id = Column(Integer, ForeignKey("collection_items.id"), nullable=False)
    borrower = Column(String(200), nullable=False)
    borrower_contact = Column(String(200))
    purpose = Column(String(500), nullable=False)
    destination = Column(String(300), nullable=False)
    start_date = Column(DateTime(timezone=True), nullable=False)
    end_date = Column(DateTime(timezone=True), nullable=False)
    status = Column(SQLEnum(ApprovalStatus), default=ApprovalStatus.DRAFT, index=True)
    
    applicant = Column(String(100), nullable=False)
    applicant_department = Column(String(100))
    current_approver = Column(String(100))
    
    comments = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    item = relationship("CollectionItem", back_populates="approvals")
    insurance = relationship("InsurancePolicy", back_populates="approval", uselist=False)
    transport_records = relationship("TransportRecord", back_populates="approval")
    environment_logs = relationship("EnvironmentLog", back_populates="approval")
    return_inspection = relationship("ReturnInspection", back_populates="approval", uselist=False)
    approval_tasks = relationship("ApprovalTask", back_populates="approval")
    operation_history = relationship("OperationHistory", back_populates="approval")
    tasks = relationship("BackgroundTask", back_populates="approval")


class InsurancePolicy(Base):
    __tablename__ = "insurance_policies"
    
    id = Column(Integer, primary_key=True, index=True)
    policy_no = Column(String(100), unique=True, index=True, nullable=False)
    approval_id = Column(Integer, ForeignKey("outbound_approvals.id"), nullable=False)
    item_id = Column(Integer, ForeignKey("collection_items.id"), nullable=False)
    
    insurance_company = Column(String(200), nullable=False)
    insured_value = Column(Float, nullable=False)
    coverage_start = Column(DateTime(timezone=True), nullable=False)
    coverage_end = Column(DateTime(timezone=True), nullable=False)
    coverage_details = Column(Text)
    
    issued_at = Column(DateTime(timezone=True))
    status = Column(String(50), default="draft")
    policy_document_url = Column(String(500))
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    approval = relationship("OutboundApproval", back_populates="insurance")
    item = relationship("CollectionItem", back_populates="insurance_policies")


class TransportRecord(Base):
    __tablename__ = "transport_records"
    
    id = Column(Integer, primary_key=True, index=True)
    approval_id = Column(Integer, ForeignKey("outbound_approvals.id"), nullable=False)
    sequence = Column(Integer, nullable=False)
    
    node_name = Column(String(200), nullable=False)
    node_type = Column(String(50))
    location = Column(String(300))
    handler = Column(String(100))
    handler_contact = Column(String(200))
    
    arrival_time = Column(DateTime(timezone=True))
    departure_time = Column(DateTime(timezone=True))
    condition_check = Column(Text)
    remarks = Column(Text)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    approval = relationship("OutboundApproval", back_populates="transport_records")


class EnvironmentLog(Base):
    __tablename__ = "environment_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    approval_id = Column(Integer, ForeignKey("outbound_approvals.id"), nullable=False)
    transport_record_id = Column(Integer, ForeignKey("transport_records.id"))
    
    record_time = Column(DateTime(timezone=True), nullable=False)
    temperature = Column(Float)
    humidity = Column(Float)
    light_level = Column(Float)
    vibration = Column(Float)
    
    status = Column(String(50), default="normal")
    notes = Column(Text)
    operator = Column(String(100))
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    approval = relationship("OutboundApproval", back_populates="environment_logs")


class ReturnInspection(Base):
    __tablename__ = "return_inspections"
    
    id = Column(Integer, primary_key=True, index=True)
    approval_id = Column(Integer, ForeignKey("outbound_approvals.id"), nullable=False, unique=True)
    
    return_date = Column(DateTime(timezone=True), nullable=False)
    inspector = Column(String(100), nullable=False)
    inspector_department = Column(String(100))
    
    condition_before = Column(Text)
    condition_after = Column(Text)
    damage_found = Column(Boolean, default=False)
    damage_description = Column(Text)
    
    packaging_check = Column(Text)
    documents_complete = Column(Boolean, default=True)
    missing_items = Column(Text)
    
    overall_status = Column(String(50), default="normal")
    recommendations = Column(Text)
    signature_url = Column(String(500))
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    approval = relationship("OutboundApproval", back_populates="return_inspection")


class ApprovalTask(Base):
    __tablename__ = "approval_tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    approval_id = Column(Integer, ForeignKey("outbound_approvals.id"), nullable=False)
    sequence = Column(Integer, nullable=False)
    
    approver_role = Column(String(100), nullable=False)
    approver_name = Column(String(100))
    
    status = Column(String(50), default="pending")
    decision = Column(String(50))
    comments = Column(Text)
    
    assigned_at = Column(DateTime(timezone=True))
    decided_at = Column(DateTime(timezone=True))
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    approval = relationship("OutboundApproval", back_populates="approval_tasks")


class OperationHistory(Base):
    __tablename__ = "operation_history"
    
    id = Column(Integer, primary_key=True, index=True)
    approval_id = Column(Integer, ForeignKey("outbound_approvals.id"), nullable=False)
    
    operation_type = Column(SQLEnum(OperationType), nullable=False, index=True)
    operator = Column(String(100), nullable=False)
    operator_role = Column(String(100))
    
    old_status = Column(String(50))
    new_status = Column(String(50))
    
    description = Column(Text)
    details = Column(JSON)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    approval = relationship("OutboundApproval", back_populates="operation_history")


class BackgroundTask(Base):
    __tablename__ = "background_tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(String(100), unique=True, index=True, nullable=False)
    task_type = Column(String(100), nullable=False, index=True)
    
    approval_id = Column(Integer, ForeignKey("outbound_approvals.id"))
    
    status = Column(SQLEnum(TaskStatus), default=TaskStatus.PENDING, index=True)
    attempts = Column(Integer, default=0)
    max_attempts = Column(Integer, default=3)
    
    payload = Column(JSON)
    result = Column(JSON)
    error_message = Column(Text)
    error_trace = Column(Text)
    
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    last_attempt_at = Column(DateTime(timezone=True))
    
    next_retry_at = Column(DateTime(timezone=True))
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    approval = relationship("OutboundApproval", back_populates="tasks")
