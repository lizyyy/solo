from sqlalchemy import Column, Integer, String, DateTime, Text, JSON, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class FailureCase(Base):
    __tablename__ = "failure_cases"

    id = Column(Integer, primary_key=True, index=True)
    page_path = Column(String(500), index=True)
    browser_matrix = Column(JSON)
    failure_cases = Column(JSON)
    reporter = Column(String(100))
    conclusion = Column(String(50), default="pending")
    conclusion_note = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    exemptions = relationship("Exemption", back_populates="failure_case")


class Exemption(Base):
    __tablename__ = "exemptions"

    id = Column(Integer, primary_key=True, index=True)
    failure_id = Column(Integer, ForeignKey("failure_cases.id"))
    exemption_reason = Column(Text)
    exempt_browsers = Column(JSON)
    expire_at = Column(DateTime(timezone=True))
    applicant = Column(String(100))
    status = Column(String(50), default="pending")
    review_result = Column(String(50))
    review_comment = Column(Text)
    reviewer = Column(String(100))
    reviewed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    failure_case = relationship("FailureCase", back_populates="exemptions")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    operation_type = Column(String(100))
    resource_type = Column(String(100))
    resource_id = Column(Integer)
    operator = Column(String(100))
    original_input = Column(JSON)
    process_result = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
