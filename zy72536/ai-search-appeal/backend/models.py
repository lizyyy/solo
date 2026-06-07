from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base


class AppealTicket(Base):
    __tablename__ = "appeal_tickets"

    id = Column(Integer, primary_key=True, index=True)
    ticket_no = Column(String, unique=True, index=True, nullable=False)
    source = Column(String, default="线上反馈工单")
    original_row_no = Column(Integer, nullable=False)
    raw_content = Column(JSON, nullable=False)
    status = Column(String, default="待处理")
    handler = Column(String, default=None)
    desensitization_note = Column(Text, default=None)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    samples = relationship("Sample", back_populates="ticket", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="ticket", cascade="all, delete-orphan")


class Sample(Base):
    __tablename__ = "samples"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("appeal_tickets.id"), nullable=False)
    sample_no = Column(String, index=True, nullable=False)
    query = Column(String, nullable=False)
    doc_title = Column(String, nullable=False)
    doc_url = Column(String, nullable=False)
    original_rank = Column(Integer, nullable=False)
    expected_rank = Column(Integer, default=None)
    confidence = Column(Float, nullable=False)
    is_low_confidence = Column(Boolean, default=False)
    is_hidden_by_avg = Column(Boolean, default=False)
    current_rank = Column(Integer, default=None)
    status = Column(String, default="待复核")
    manual_note = Column(Text, default=None)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    ticket = relationship("AppealTicket", back_populates="samples")
    versions = relationship("SampleVersion", back_populates="sample", cascade="all, delete-orphan")


class ModelVersion(Base):
    __tablename__ = "model_versions"

    id = Column(Integer, primary_key=True, index=True)
    version_name = Column(String, unique=True, nullable=False)
    description = Column(String, default=None)
    created_at = Column(DateTime, default=datetime.utcnow)

    sample_versions = relationship("SampleVersion", back_populates="model_version")


class SampleVersion(Base):
    __tablename__ = "sample_versions"

    id = Column(Integer, primary_key=True, index=True)
    sample_id = Column(Integer, ForeignKey("samples.id"), nullable=False)
    model_version_id = Column(Integer, ForeignKey("model_versions.id"), nullable=False)
    rank = Column(Integer, nullable=False)
    score = Column(Float, nullable=False)
    is_manual_modified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    sample = relationship("Sample", back_populates="versions")
    model_version = relationship("ModelVersion", back_populates="sample_versions")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("appeal_tickets.id"), nullable=False)
    sample_id = Column(Integer, ForeignKey("samples.id"), default=None)
    action = Column(String, nullable=False)
    operator = Column(String, nullable=False)
    before_value = Column(JSON, default=None)
    after_value = Column(JSON, default=None)
    note = Column(Text, default=None)
    created_at = Column(DateTime, default=datetime.utcnow)

    ticket = relationship("AppealTicket", back_populates="audit_logs")


class SelfCheckResult(Base):
    __tablename__ = "self_check_results"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("appeal_tickets.id"), nullable=False)
    check_type = Column(String, nullable=False)
    passed = Column(Boolean, nullable=False)
    details = Column(JSON, default=None)
    created_at = Column(DateTime, default=datetime.utcnow)
