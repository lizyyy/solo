from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from database import Base


class Batch(Base):
    __tablename__ = "batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String(50), unique=True, nullable=False)
    name = Column(String(200), nullable=False)
    source = Column(String(100), nullable=False)
    created_by = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=datetime.now)
    status = Column(String(20), default="processing")

    records = relationship("PolicyRecord", back_populates="batch", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="batch")


class PolicyRecord(Base):
    __tablename__ = "policy_records"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    policy_no = Column(String(100), nullable=False)
    policy_holder = Column(String(200))
    agent_nickname = Column(String(100))
    agent_real_name = Column(String(100))

    raw_effective_date = Column(String(100))
    effective_date = Column(DateTime)

    raw_cash_value = Column(String(100))
    cash_value = Column(Float)
    currency = Column(String(10), default="CNY")

    surrender_date = Column(DateTime)
    surrender_amount = Column(Float)

    source_type = Column(String(50), nullable=False)
    source_reference = Column(String(200))
    source_attachment_id = Column(Integer, ForeignKey("source_attachments.id"))

    status = Column(String(20), default="pending")
    is_suspended = Column(Boolean, default=False)
    suspension_reason = Column(Text)

    confirmed_by = Column(String(100))
    confirmed_at = Column(DateTime)
    confirmation_notes = Column(Text)

    raw_data = Column(Text)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    batch = relationship("Batch", back_populates="records")
    audit_logs = relationship("AuditLog", back_populates="record")
    source_attachment = relationship("SourceAttachment", back_populates="records")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    record_id = Column(Integer, ForeignKey("policy_records.id"))
    action = Column(String(50), nullable=False)
    operator = Column(String(100), nullable=False)
    old_value = Column(Text)
    new_value = Column(Text)
    notes = Column(Text)
    decision_reasoning = Column(Text)
    created_at = Column(DateTime, default=datetime.now)

    batch = relationship("Batch", back_populates="audit_logs")
    record = relationship("PolicyRecord", back_populates="audit_logs")


class SourceAttachment(Base):
    __tablename__ = "source_attachments"

    id = Column(Integer, primary_key=True, index=True)
    source_type = Column(String(50), nullable=False)
    reference_no = Column(String(200), nullable=False)
    title = Column(String(200))
    received_date = Column(DateTime)
    original_filename = Column(String(500))
    content_hash = Column(String(100))
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.now)

    records = relationship("PolicyRecord", back_populates="source_attachment")
