from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from database import Base


class ApplicationStatus(str, enum.Enum):
    DRAFT = "草稿"
    SUBMITTED = "已提交"
    UNDER_REVIEW = "预审中"
    NEEDS_CORRECTION = "需补正"
    CORRECTED = "已补正"
    REJECTED = "已退回"
    ACCEPTED = "窗口受理"
    COMPLETED = "已办结"


class MaterialStatus(str, enum.Enum):
    UPLOADED = "已上传"
    UNDER_REVIEW = "预审中"
    APPROVED = "通过"
    REJECTED = "不通过"
    NEEDS_CORRECTION = "需补正"
    CORRECTED = "已补正"


class CorrectionTaskStatus(str, enum.Enum):
    PENDING = "待处理"
    IN_PROGRESS = "处理中"
    COMPLETED = "已完成"
    FAILED = "失败"


class Material(Base):
    __tablename__ = "materials"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False)
    category = Column(String(100), index=True)
    description = Column(Text)
    required = Column(String(50), default="必填")
    format = Column(String(100))
    page_count = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    review_rules = relationship("ReviewRule", back_populates="material")
    application_materials = relationship("ApplicationMaterial", back_populates="material")


class ReviewRule(Base):
    __tablename__ = "review_rules"

    id = Column(Integer, primary_key=True, index=True)
    material_id = Column(Integer, ForeignKey("materials.id"), nullable=False)
    rule_name = Column(String(200), nullable=False)
    rule_type = Column(String(50), nullable=False)
    rule_content = Column(Text, nullable=False)
    priority = Column(Integer, default=1)
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    material = relationship("Material", back_populates="review_rules")


class Application(Base):
    __tablename__ = "applications"

    id = Column(Integer, primary_key=True, index=True)
    application_no = Column(String(50), unique=True, index=True)
    applicant_name = Column(String(100), nullable=False)
    applicant_id = Column(String(50), index=True)
    business_type = Column(String(100), index=True)
    status = Column(SQLEnum(ApplicationStatus), default=ApplicationStatus.DRAFT, index=True)
    current_step = Column(String(100))
    submit_time = Column(DateTime)
    accept_time = Column(DateTime)
    complete_time = Column(DateTime)
    reject_reason = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    materials = relationship("ApplicationMaterial", back_populates="application")
    status_history = relationship("ApplicationStatusHistory", back_populates="application")
    correction_tasks = relationship("CorrectionTask", back_populates="application")


class ApplicationMaterial(Base):
    __tablename__ = "application_materials"

    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("applications.id"), nullable=False)
    material_id = Column(Integer, ForeignKey("materials.id"), nullable=False)
    material_name = Column(String(200), nullable=False)
    file_path = Column(String(500))
    file_name = Column(String(200))
    file_size = Column(Integer)
    status = Column(SQLEnum(MaterialStatus), default=MaterialStatus.UPLOADED, index=True)
    review_result = Column(Text)
    review_time = Column(DateTime)
    reviewer = Column(String(100))
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    application = relationship("Application", back_populates="materials")
    material = relationship("Material", back_populates="application_materials")
    correction_tasks = relationship("CorrectionTask", back_populates="application_material")


class ApplicationStatusHistory(Base):
    __tablename__ = "application_status_history"

    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("applications.id"), nullable=False)
    from_status = Column(String(50))
    to_status = Column(String(50), nullable=False)
    reason = Column(Text)
    operator = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)

    application = relationship("Application", back_populates="status_history")


class CorrectionTask(Base):
    __tablename__ = "correction_tasks"

    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("applications.id"), nullable=False)
    application_material_id = Column(Integer, ForeignKey("application_materials.id"), nullable=False)
    task_name = Column(String(200), nullable=False)
    correction_content = Column(Text, nullable=False)
    status = Column(SQLEnum(CorrectionTaskStatus), default=CorrectionTaskStatus.PENDING, index=True)
    assignee = Column(String(100))
    due_date = Column(DateTime)
    completed_at = Column(DateTime)
    retry_count = Column(Integer, default=0)
    last_error = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    application = relationship("Application", back_populates="correction_tasks")
    application_material = relationship("ApplicationMaterial", back_populates="correction_tasks")


class RejectReason(Base):
    __tablename__ = "reject_reasons"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    category = Column(String(100))
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)


class AcceptNumberCounter(Base):
    __tablename__ = "accept_number_counter"

    id = Column(Integer, primary_key=True, index=True)
    prefix = Column(String(10), unique=True, nullable=False)
    counter = Column(Integer, default=0)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
