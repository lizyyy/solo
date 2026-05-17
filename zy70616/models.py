from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey, Text, Float, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum


class EmployeeStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class CertificateStatus(str, enum.Enum):
    VALID = "valid"
    EXPIRING_SOON = "expiring_soon"
    EXPIRED = "expired"


class ExamStatus(str, enum.Enum):
    PASSED = "passed"
    FAILED = "failed"
    PENDING = "pending"


class RetakeStatus(str, enum.Enum):
    NOT_STARTED = "not_started"
    SCHEDULED = "scheduled"
    COMPLETED_PASSED = "completed_passed"
    COMPLETED_FAILED = "completed_failed"


class RenewalStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    APPROVED = "approved"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"
    CLOSED = "closed"


class QualificationMatch(str, enum.Enum):
    FULLY_MATCHED = "fully_matched"
    PARTIALLY_MATCHED = "partially_matched"
    NOT_MATCHED = "not_matched"


class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    department = Column(String)
    position = Column(String)
    status = Column(String, default=EmployeeStatus.ACTIVE)
    hire_date = Column(Date)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    certificates = relationship("EmployeeCertificate", back_populates="employee")
    course_scores = relationship("CourseScore", back_populates="employee")
    retakes = relationship("RetakeRecord", back_populates="employee")
    position_requirements = relationship("PositionRequirement", back_populates="employee")
    renewal_items = relationship("RenewalItem", back_populates="employee")


class CertificateType(Base):
    __tablename__ = "certificate_types"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text)
    validity_period_months = Column(Integer)
    required_courses = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class EmployeeCertificate(Base):
    __tablename__ = "employee_certificates"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    certificate_type_id = Column(Integer, ForeignKey("certificate_types.id"), nullable=False)
    certificate_number = Column(String, unique=True, index=True)
    issue_date = Column(Date, nullable=False)
    expiry_date = Column(Date, nullable=False)
    status = Column(String, default=CertificateStatus.VALID)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    employee = relationship("Employee", back_populates="certificates")
    certificate_type = relationship("CertificateType")


class CourseScore(Base):
    __tablename__ = "course_scores"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    course_code = Column(String, nullable=False)
    course_name = Column(String, nullable=False)
    score = Column(Float, nullable=False)
    exam_date = Column(Date, nullable=False)
    status = Column(String, default=ExamStatus.PASSED)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    employee = relationship("Employee", back_populates="course_scores")
    retakes = relationship("RetakeRecord", back_populates="course_score")


class RetakeRecord(Base):
    __tablename__ = "retake_records"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    course_score_id = Column(Integer, ForeignKey("course_scores.id"), nullable=False)
    attempt_number = Column(Integer, default=1)
    scheduled_date = Column(Date)
    actual_date = Column(Date)
    score = Column(Float)
    status = Column(String, default=RetakeStatus.NOT_STARTED)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    employee = relationship("Employee", back_populates="retakes")
    course_score = relationship("CourseScore", back_populates="retakes")


class PositionRequirement(Base):
    __tablename__ = "position_requirements"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    position_name = Column(String, nullable=False)
    required_certificate_types = Column(Text)
    required_courses = Column(Text)
    qualification_match = Column(String, default=QualificationMatch.NOT_MATCHED)
    match_details = Column(Text)
    evaluated_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    employee = relationship("Employee", back_populates="position_requirements")


class RenewalItem(Base):
    __tablename__ = "renewal_items"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    employee_certificate_id = Column(Integer, ForeignKey("employee_certificates.id"))
    renewal_batch = Column(String, nullable=False)
    status = Column(String, default=RenewalStatus.PENDING)
    due_date = Column(Date)
    assigned_to = Column(String)
    notes = Column(Text)
    processed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    employee = relationship("Employee", back_populates="renewal_items")
    employee_certificate = relationship("EmployeeCertificate")
    operation_logs = relationship("OperationLog", back_populates="renewal_item")


class OperationLog(Base):
    __tablename__ = "operation_logs"

    id = Column(Integer, primary_key=True, index=True)
    renewal_item_id = Column(Integer, ForeignKey("renewal_items.id"))
    operation_type = Column(String, nullable=False)
    operator = Column(String, nullable=False)
    original_input = Column(Text)
    processing_result = Column(Text)
    conclusion = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    renewal_item = relationship("RenewalItem", back_populates="operation_logs")
