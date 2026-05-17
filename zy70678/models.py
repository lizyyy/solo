from sqlalchemy import Column, Integer, String, Date, Boolean, ForeignKey, Text, DateTime, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum


class MaterialStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    NEED_REVIEW = "need_review"
    PROCESSED = "processed"


class IssueLevel(str, enum.Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    gender = Column(String)
    grade = Column(String)
    major = Column(String)
    phone = Column(String)
    id_card = Column(String)
    address = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    family_members = relationship("FamilyMember", back_populates="student", cascade="all, delete-orphan")
    materials = relationship("StudentMaterial", back_populates="student", cascade="all, delete-orphan")
    review_reports = relationship("ReviewReport", back_populates="student", cascade="all, delete-orphan")


class FamilyMember(Base):
    __tablename__ = "family_members"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    name = Column(String, nullable=False)
    relation = Column(String, nullable=False)
    age = Column(Integer)
    id_card = Column(String)
    workplace = Column(String)
    annual_income = Column(Float)
    health_status = Column(String)
    is_source_of_income = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    student = relationship("Student", back_populates="family_members")


class MaterialType(Base):
    __tablename__ = "material_types"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text)
    validity_days = Column(Integer)
    is_required = Column(Boolean, default=True)
    need_stamp = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class StudentMaterial(Base):
    __tablename__ = "student_materials"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    material_type_id = Column(Integer, ForeignKey("material_types.id"), nullable=False)
    file_name = Column(String)
    upload_date = Column(Date)
    issue_date = Column(Date)
    expiry_date = Column(Date)
    has_stamp = Column(Boolean, default=False)
    status = Column(String, default=MaterialStatus.PENDING)
    remarks = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    student = relationship("Student", back_populates="materials")
    material_type = relationship("MaterialType")
    issues = relationship("MaterialIssue", back_populates="material", cascade="all, delete-orphan")


class MaterialIssue(Base):
    __tablename__ = "material_issues"

    id = Column(Integer, primary_key=True, index=True)
    material_id = Column(Integer, ForeignKey("student_materials.id"), nullable=False)
    issue_type = Column(String, nullable=False)
    issue_level = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    is_resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    material = relationship("StudentMaterial", back_populates="issues")


class ReviewReport(Base):
    __tablename__ = "review_reports"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    report_code = Column(String, unique=True, nullable=False)
    total_materials = Column(Integer, default=0)
    missing_materials = Column(Integer, default=0)
    expired_materials = Column(Integer, default=0)
    no_stamp_materials = Column(Integer, default=0)
    family_consistency_issues = Column(Integer, default=0)
    total_issues = Column(Integer, default=0)
    critical_issues = Column(Integer, default=0)
    status = Column(String, default=MaterialStatus.PENDING)
    review_date = Column(Date)
    reviewer = Column(String)
    remarks = Column(Text)
    exported_file_path = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    student = relationship("Student", back_populates="review_reports")
