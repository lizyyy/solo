from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum, Float, Boolean, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from database import Base


class ContractStatus(str, enum.Enum):
    UPLOADED = "uploaded"
    EXTRACTING = "extracting"
    EXTRACTED = "extracted"
    REVIEWING = "reviewing"
    APPROVED = "approved"
    REJECTED = "rejected"
    FAILED = "failed"


class RiskLevel(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ClauseType(Base):
    __tablename__ = "clause_types"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    clauses = relationship("Clause", back_populates="clause_type")


class Contract(Base):
    __tablename__ = "contracts"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer)
    contract_name = Column(String(255))
    party_a = Column(String(255))
    party_b = Column(String(255))
    effective_date = Column(DateTime(timezone=True))
    expiration_date = Column(DateTime(timezone=True))
    status = Column(Enum(ContractStatus), default=ContractStatus.UPLOADED)
    overall_risk = Column(Enum(RiskLevel), default=RiskLevel.LOW)
    extracted_at = Column(DateTime(timezone=True))
    task_id = Column(String(100))
    retry_count = Column(Integer, default=0)
    error_message = Column(Text)
    created_by = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    clauses = relationship("Clause", back_populates="contract", cascade="all, delete-orphan")
    versions = relationship("ContractVersion", back_populates="contract", cascade="all, delete-orphan")
    timeline = relationship("TimelineEvent", back_populates="contract", cascade="all, delete-orphan")


class Clause(Base):
    __tablename__ = "clauses"

    id = Column(Integer, primary_key=True, index=True)
    contract_id = Column(Integer, ForeignKey("contracts.id"), nullable=False)
    clause_type_id = Column(Integer, ForeignKey("clause_types.id"))
    clause_title = Column(String(255))
    original_text = Column(Text, nullable=False)
    extracted_text = Column(Text)
    revised_text = Column(Text)
    risk_level = Column(Enum(RiskLevel), default=RiskLevel.LOW)
    risk_reason = Column(Text)
    confidence_score = Column(Float)
    is_approved = Column(Boolean, default=False)
    approved_by = Column(String(100))
    approved_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    contract = relationship("Contract", back_populates="clauses")
    clause_type = relationship("ClauseType", back_populates="clauses")
    revisions = relationship("ClauseRevision", back_populates="clause", cascade="all, delete-orphan")


class ClauseRevision(Base):
    __tablename__ = "clause_revisions"

    id = Column(Integer, primary_key=True, index=True)
    clause_id = Column(Integer, ForeignKey("clauses.id"), nullable=False)
    version_number = Column(Integer, nullable=False)
    text_before = Column(Text)
    text_after = Column(Text)
    revised_by = Column(String(100))
    revision_note = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    clause = relationship("Clause", back_populates="revisions")


class ContractVersion(Base):
    __tablename__ = "contract_versions"

    id = Column(Integer, primary_key=True, index=True)
    contract_id = Column(Integer, ForeignKey("contracts.id"), nullable=False)
    version_number = Column(Integer, nullable=False)
    status = Column(Enum(ContractStatus))
    overall_risk = Column(Enum(RiskLevel))
    created_by = Column(String(100))
    change_log = Column(Text)
    clauses_snapshot = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    contract = relationship("Contract", back_populates="versions")


class TimelineEvent(Base):
    __tablename__ = "timeline_events"

    id = Column(Integer, primary_key=True, index=True)
    contract_id = Column(Integer, ForeignKey("contracts.id"), nullable=False)
    event_type = Column(String(50), nullable=False)
    event_data = Column(Text)
    created_by = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    contract = relationship("Contract", back_populates="timeline")
