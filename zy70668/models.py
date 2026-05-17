from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(String(20), unique=True, index=True, nullable=False)
    name = Column(String(50), nullable=False)
    grade = Column(String(20))
    major = Column(String(50))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    credit_applications = relationship("CreditApplication", back_populates="student")
    reports = relationship("CreditReport", back_populates="student")


class ActivityType(Base):
    __tablename__ = "activity_types"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(20), unique=True, index=True, nullable=False)
    name = Column(String(50), nullable=False)
    max_credit = Column(Float, nullable=False)
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    credit_applications = relationship("CreditApplication", back_populates="activity_type")


class CreditApplication(Base):
    __tablename__ = "credit_applications"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    activity_type_id = Column(Integer, ForeignKey("activity_types.id"), nullable=False)
    activity_name = Column(String(100), nullable=False)
    activity_date = Column(DateTime(timezone=True))
    credit = Column(Float, nullable=False)
    proof_material = Column(Text)
    status = Column(String(20), default="pending")
    is_duplicate = Column(Boolean, default=False)
    duplicate_of = Column(Integer, ForeignKey("credit_applications.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    student = relationship("Student", back_populates="credit_applications")
    activity_type = relationship("ActivityType", back_populates="credit_applications")
    rejection = relationship("RejectionReason", back_populates="application", uselist=False)
    audit_logs = relationship("AuditLog", back_populates="application")


class RejectionReason(Base):
    __tablename__ = "rejection_reasons"

    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("credit_applications.id"), nullable=False)
    reason = Column(Text, nullable=False)
    handler = Column(String(50), nullable=False)
    handled_at = Column(DateTime(timezone=True), server_default=func.now())
    original_input = Column(Text)
    conclusion = Column(Text)

    application = relationship("CreditApplication", back_populates="rejection")


class CreditReport(Base):
    __tablename__ = "credit_reports"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    report_date = Column(DateTime(timezone=True), server_default=func.now())
    lecture_credit = Column(Float, default=0.0)
    competition_credit = Column(Float, default=0.0)
    volunteer_credit = Column(Float, default=0.0)
    total_credit = Column(Float, default=0.0)
    status = Column(String(20), default="draft")
    generated_by = Column(String(50))

    student = relationship("Student", back_populates="reports")
    details = relationship("ReportDetail", back_populates="report")


class ReportDetail(Base):
    __tablename__ = "report_details"

    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(Integer, ForeignKey("credit_reports.id"), nullable=False)
    activity_type_id = Column(Integer, ForeignKey("activity_types.id"), nullable=False)
    activity_name = Column(String(100), nullable=False)
    credit = Column(Float, nullable=False)
    status = Column(String(20))
    rejection_reason = Column(Text)

    report = relationship("CreditReport", back_populates="details")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("credit_applications.id"), nullable=False)
    action = Column(String(50), nullable=False)
    handler = Column(String(50), nullable=False)
    previous_status = Column(String(20))
    new_status = Column(String(20))
    comment = Column(Text)
    original_data = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    application = relationship("CreditApplication", back_populates="audit_logs")
