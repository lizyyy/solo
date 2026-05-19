from sqlalchemy import Column, String, Integer, DateTime, Text, Boolean, ForeignKey, Enum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

Base = declarative_base()

class ApprovalStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    BLOCKED = "blocked"
    NEEDS_REVIEW = "needs_review"

class RegionRuleStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"

class BlockReasonCategory(str, enum.Enum):
    DATA_CLASSIFICATION = "data_classification"
    REGION_COMPLIANCE = "region_compliance"
    CROSS_BORDER = "cross_border"
    CUSTOMER_POLICY = "customer_policy"
    TECHNICAL_LIMITATION = "technical_limitation"

class Tenant(Base):
    __tablename__ = "tenants"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, unique=True, index=True, nullable=False)
    tenant_name = Column(String, nullable=False)
    industry = Column(String)
    region = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    approvals = relationship("DataResidencyApproval", back_populates="tenant")

class RegionRule(Base):
    __tablename__ = "region_rules"
    
    id = Column(Integer, primary_key=True, index=True)
    region_code = Column(String, index=True, nullable=False)
    region_name = Column(String, nullable=False)
    data_type = Column(String, index=True, nullable=False)
    requires_approval = Column(Boolean, default=True)
    allow_cross_border = Column(Boolean, default=False)
    max_retention_days = Column(Integer)
    status = Column(Enum(RegionRuleStatus), default=RegionRuleStatus.ACTIVE)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class DataResidencyApproval(Base):
    __tablename__ = "data_residency_approvals"
    
    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(String, unique=True, index=True, nullable=False)
    tenant_id = Column(String, ForeignKey("tenants.tenant_id"), nullable=False)
    target_region = Column(String, nullable=False)
    data_type = Column(String, nullable=False)
    data_volume_gb = Column(Integer)
    status = Column(Enum(ApprovalStatus), default=ApprovalStatus.PENDING)
    approver = Column(String)
    approval_comment = Column(Text)
    block_reason = Column(Text)
    block_category = Column(Enum(BlockReasonCategory))
    submitted_at = Column(DateTime, default=datetime.utcnow)
    reviewed_at = Column(DateTime)
    completed_at = Column(DateTime)
    idempotency_key = Column(String, unique=True, index=True)
    
    tenant_rel = relationship("Tenant", back_populates="approvals")
    report = relationship("ResidencyReport", back_populates="approval", uselist=False)

class ResidencyReport(Base):
    __tablename__ = "residency_reports"
    
    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(String, unique=True, index=True, nullable=False)
    approval_id = Column(Integer, ForeignKey("data_residency_approvals.id"), nullable=False)
    report_content = Column(Text, nullable=False)
    generated_at = Column(DateTime, default=datetime.utcnow)
    generated_by = Column(String)
    
    approval = relationship("DataResidencyApproval", back_populates="report")
