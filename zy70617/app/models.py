from sqlalchemy import Column, Integer, String, Date, Boolean, ForeignKey, Text, DateTime, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum


class CertificateStatus(str, enum.Enum):
    VALID = "有效"
    EXPIRING_SOON = "即将过期"
    EXPIRED = "已过期"


class RetakeStatus(str, enum.Enum):
    NOT_STARTED = "未开始"
    IN_PROGRESS = "进行中"
    PASSED = "已通过"
    FAILED = "未通过"


class RenewalStatus(str, enum.Enum):
    PENDING = "待处理"
    IN_PROGRESS = "处理中"
    COMPLETED = "已完成"
    CANCELLED = "已取消"
    CLOSED = "已关闭"


class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    department = Column(String)
    position = Column(String)
    email = Column(String)
    phone = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    certificates = relationship("EmployeeCertificate", back_populates="employee")
    course_scores = relationship("CourseScore", back_populates="employee")
    retake_records = relationship("RetakeRecord", back_populates="employee")
    position_qualifications = relationship("PositionQualification", back_populates="employee")
    renewal_items = relationship("RenewalItem", back_populates="employee")


class CertificateType(Base):
    __tablename__ = "certificate_types"

    id = Column(Integer, primary_key=True, index=True)
    type_code = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text)
    validity_period_months = Column(Integer)
    required_score = Column(Float, default=60.0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    position_requirements = relationship("PositionRequirement", back_populates="certificate_type")
    employee_certificates = relationship("EmployeeCertificate", back_populates="certificate_type")


class EmployeeCertificate(Base):
    __tablename__ = "employee_certificates"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    certificate_type_id = Column(Integer, ForeignKey("certificate_types.id"), nullable=False)
    certificate_number = Column(String, unique=True, index=True)
    issue_date = Column(Date, nullable=False)
    expiry_date = Column(Date)
    score = Column(Float)
    is_valid = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    employee = relationship("Employee", back_populates="certificates")
    certificate_type = relationship("CertificateType", back_populates="employee_certificates")


class CourseScore(Base):
    __tablename__ = "course_scores"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    certificate_type_id = Column(Integer, ForeignKey("certificate_types.id"), nullable=False)
    course_name = Column(String, nullable=False)
    score = Column(Float, nullable=False)
    exam_date = Column(Date, nullable=False)
    is_passed = Column(Boolean, default=False)
    remarks = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    employee = relationship("Employee", back_populates="course_scores")
    retake_records = relationship("RetakeRecord", back_populates="course_score")


class RetakeRecord(Base):
    __tablename__ = "retake_records"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    course_score_id = Column(Integer, ForeignKey("course_scores.id"), nullable=False)
    retake_count = Column(Integer, default=1)
    retake_date = Column(Date)
    retake_score = Column(Float)
    status = Column(String, default=RetakeStatus.NOT_STARTED)
    is_passed = Column(Boolean, default=False)
    remarks = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    employee = relationship("Employee", back_populates="retake_records")
    course_score = relationship("CourseScore", back_populates="retake_records")


class PositionRequirement(Base):
    __tablename__ = "position_requirements"

    id = Column(Integer, primary_key=True, index=True)
    position_name = Column(String, nullable=False)
    certificate_type_id = Column(Integer, ForeignKey("certificate_types.id"), nullable=False)
    is_required = Column(Boolean, default=True)
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    certificate_type = relationship("CertificateType", back_populates="position_requirements")


class PositionQualification(Base):
    __tablename__ = "position_qualifications"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    position_name = Column(String, nullable=False)
    certificate_type_id = Column(Integer, ForeignKey("certificate_types.id"), nullable=False)
    is_qualified = Column(Boolean, default=False)
    qualification_date = Column(Date)
    remarks = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    employee = relationship("Employee", back_populates="position_qualifications")


class RenewalItem(Base):
    __tablename__ = "renewal_items"

    id = Column(Integer, primary_key=True, index=True)
    renewal_code = Column(String, unique=True, index=True, nullable=False)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    certificate_type_id = Column(Integer, ForeignKey("certificate_types.id"), nullable=False)
    employee_certificate_id = Column(Integer, ForeignKey("employee_certificates.id"))
    status = Column(String, default=RenewalStatus.PENDING)
    priority = Column(Integer, default=1)
    due_date = Column(Date)
    assigned_to = Column(String)
    remarks = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    employee = relationship("Employee", back_populates="renewal_items")


class ExceptionLog(Base):
    __tablename__ = "exception_logs"

    id = Column(Integer, primary_key=True, index=True)
    operation_type = Column(String, nullable=False)
    original_input = Column(Text, nullable=False)
    handler = Column(String)
    conclusion = Column(Text)
    error_message = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
