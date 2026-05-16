import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, Enum, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class RiskLevel(str, enum.Enum):
    UNKNOWN = "unknown"
    SAFE = "safe"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class VerdictStatus(str, enum.Enum):
    CREATED = "created"
    ANALYZING = "analyzing"
    AWAITING_CONFIRMATION = "awaiting_confirmation"
    CONFIRMED = "confirmed"
    APPEALED = "appealed"
    REJECTED = "rejected"
    APPROVED = "approved"
    DEFERRED = "deferred"
    COMPLETED = "completed"


class ChangeCategory(str, enum.Enum):
    DOCUMENTATION_ONLY = "documentation_only"
    COMPATIBLE = "compatible"
    BREAKING = "breaking"
    UNKNOWN = "unknown"


class ContractChange(Base):
    __tablename__ = "contract_changes"

    id = Column(Integer, primary_key=True, index=True)
    api_path = Column(String, index=True, nullable=False)
    http_method = Column(String, index=True, nullable=False)
    old_contract = Column(JSON, nullable=False)
    new_contract = Column(JSON, nullable=False)
    caller = Column(String, index=True, nullable=False)
    risk_level = Column(Enum(RiskLevel), default=RiskLevel.UNKNOWN)
    verdict_opinion = Column(Text)
    status = Column(Enum(VerdictStatus), default=VerdictStatus.CREATED)
    change_category = Column(Enum(ChangeCategory), default=ChangeCategory.UNKNOWN)
    diff_summary = Column(JSON)
    raw_input = Column(JSON)
    processing_basis = Column(Text)
    final_conclusion = Column(Text)
    error_message = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    confirmed_at = Column(DateTime)
    completed_at = Column(DateTime)
    deferral_reason = Column(Text)
    deferral_expiry = Column(DateTime)
    manual_override = Column(JSON)
    reports = relationship("VerdictReport", back_populates="contract_change")


class VerdictReport(Base):
    __tablename__ = "verdict_reports"

    id = Column(Integer, primary_key=True, index=True)
    contract_change_id = Column(Integer, ForeignKey("contract_changes.id"))
    report_type = Column(String, nullable=False)
    content = Column(JSON, nullable=False)
    generated_at = Column(DateTime, default=datetime.utcnow)
    generated_by = Column(String)
    contract_change = relationship("ContractChange", back_populates="reports")


class ChangeHistory(Base):
    __tablename__ = "change_history"

    id = Column(Integer, primary_key=True, index=True)
    contract_change_id = Column(Integer, nullable=False)
    field_name = Column(String, nullable=False)
    old_value = Column(JSON)
    new_value = Column(JSON)
    changed_by = Column(String)
    changed_at = Column(DateTime, default=datetime.utcnow)
    reason = Column(Text)
