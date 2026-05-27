from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

Base = declarative_base()


class MaterialSubmission(Base):
    __tablename__ = "material_submissions"

    id = Column(Integer, primary_key=True, index=True)
    idempotency_key = Column(String, unique=True, index=True, nullable=False)
    submitter = Column(String, nullable=False)
    department = Column(String, nullable=False)
    benefit_type = Column(String, nullable=False)
    beneficiary = Column(String, nullable=False)
    beneficiary_id_card = Column(String, nullable=False)
    amount = Column(Integer, nullable=False)
    application_date = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    raw_materials = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    verification_records = relationship(
        "VerificationRecord", back_populates="submission"
    )
    audit_logs = relationship("AuditLog", back_populates="submission")


class VerificationRecord(Base):
    __tablename__ = "verification_records"

    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(
        Integer, ForeignKey("material_submissions.id"), nullable=False
    )
    status = Column(String, nullable=False)
    conclusion = Column(String, nullable=False)
    reviewer = Column(String, nullable=False)
    review_notes = Column(Text, nullable=True)
    verified_amount = Column(Integer, nullable=False)
    report_data = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    submission = relationship("MaterialSubmission", back_populates="verification_records")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(
        Integer, ForeignKey("material_submissions.id"), nullable=False
    )
    record_id = Column(Integer, nullable=True)
    operator = Column(String, nullable=False)
    operation = Column(String, nullable=False)
    field_name = Column(String, nullable=True)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    reason = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    submission = relationship("MaterialSubmission", back_populates="audit_logs")
