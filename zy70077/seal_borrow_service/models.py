from datetime import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    Boolean,
    ForeignKey,
    Enum,
    Float,
    JSON
)
from sqlalchemy.orm import relationship
from .database import Base
import enum


class SealType(str, enum.Enum):
    CONTRACT = "合同章"
    OFFICIAL = "公章"
    FINANCIAL = "财务章"
    LEGAL_PERSON = "法人章"


class SealStatus(str, enum.Enum):
    IN_STORAGE = "在库"
    BORROWED = "外借中"
    LOST = "丢失"
    DAMAGED = "损坏"
    SCRAPPED = "作废"


class ApplicationStatus(str, enum.Enum):
    DRAFT = "草稿"
    PENDING_APPROVAL = "待审批"
    APPROVED = "已批准"
    REJECTED = "已拒绝"
    LENDED = "已借出"
    RETURNED = "已归还"
    TIMEOUT = "已超时"
    LOST = "已丢失"
    CANCELLED = "已取消"


class ReturnVerificationResult(str, enum.Enum):
    VERIFIED = "核验通过"
    MATERIALS_MISSING = "材料缺失"
    SEAL_DAMAGED = "印章损坏"
    NEEDS_CONFIRM = "需人工确认"


class TimeoutLevel(str, enum.Enum):
    LEVEL1 = "一级超时"
    LEVEL2 = "二级超时"
    LEVEL3 = "三级超时"
    LEVEL4 = "四级超时"


class StatusCorrectionType(str, enum.Enum):
    NORMAL_FLOW = "正常流转"
    MANUAL_CORRECTION = "人工修正"
    SYSTEM_AUTO = "系统自动"


class FinalResult(str, enum.Enum):
    NORMAL_COMPLETION = "正常完成"
    MATERIALS_INCOMPLETE = "材料不全"
    TIMEOUT_SERIOUS = "严重超时"
    ABNORMAL_RETURN = "归还异常"
    LOST = "丢失"


class Seal(Base):
    __tablename__ = "seals"

    id = Column(Integer, primary_key=True, index=True)
    seal_code = Column(String(50), unique=True, index=True, nullable=False)
    seal_name = Column(String(100), nullable=False)
    seal_type = Column(Enum(SealType), nullable=False)
    description = Column(Text)
    status = Column(Enum(SealStatus), default=SealStatus.IN_STORAGE, nullable=False)
    custodian = Column(String(100))
    department = Column(String(100))
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    is_active = Column(Boolean, default=True)


class BorrowApplication(Base):
    __tablename__ = "borrow_applications"

    id = Column(Integer, primary_key=True, index=True)
    application_no = Column(String(50), unique=True, index=True, nullable=False)
    seal_id = Column(Integer, ForeignKey("seals.id"), nullable=False)
    applicant_id = Column(String(50), nullable=False)
    applicant_name = Column(String(100), nullable=False)
    applicant_department = Column(String(100))
    borrow_reason = Column(Text, nullable=False)
    borrow_location = Column(String(200))
    planned_borrow_date = Column(DateTime, nullable=False)
    planned_return_date = Column(DateTime, nullable=False)
    approval_person = Column(String(100))
    approval_opinion = Column(Text)
    approval_time = Column(DateTime)
    status = Column(Enum(ApplicationStatus), default=ApplicationStatus.DRAFT, nullable=False)
    current_timeout_level = Column(Enum(TimeoutLevel), nullable=True)
    final_result = Column(Enum(FinalResult), nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    seal = relationship("Seal")
    borrow_records = relationship("BorrowRecord", back_populates="application", uselist=False)
    usage_materials = relationship("UsageMaterial", back_populates="application")
    return_records = relationship("ReturnRecord", back_populates="application")
    timeout_records = relationship("TimeoutRecord", back_populates="application")
    status_histories = relationship("StatusHistory", back_populates="application")


class BorrowRecord(Base):
    __tablename__ = "borrow_records"

    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("borrow_applications.id"), nullable=False)
    actual_borrow_date = Column(DateTime, nullable=False)
    borrower_signature = Column(String(100))
    custodian_signature = Column(String(100))
    borrow_remarks = Column(Text)
    created_at = Column(DateTime, default=datetime.now)

    application = relationship("BorrowApplication", back_populates="borrow_records")


class UsageMaterial(Base):
    __tablename__ = "usage_materials"

    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("borrow_applications.id"), nullable=False)
    material_type = Column(String(100), nullable=False)
    material_name = Column(String(200), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer)
    upload_time = Column(DateTime, default=datetime.now)
    uploader = Column(String(100))
    material_description = Column(Text)
    is_verified = Column(Boolean, default=False)
    verified_by = Column(String(100))
    verified_at = Column(DateTime)
    verification_remarks = Column(Text)
    created_at = Column(DateTime, default=datetime.now)

    application = relationship("BorrowApplication", back_populates="usage_materials")


class ReturnRecord(Base):
    __tablename__ = "return_records"

    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("borrow_applications.id"), nullable=False)
    actual_return_date = Column(DateTime, nullable=False)
    verification_result = Column(Enum(ReturnVerificationResult), nullable=False)
    verification_details = Column(Text)
    verifier = Column(String(100), nullable=False)
    returned_by = Column(String(100))
    return_remarks = Column(Text)
    materials_complete = Column(Boolean, default=True)
    seal_intact = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.now)

    application = relationship("BorrowApplication", back_populates="return_records")


class TimeoutRecord(Base):
    __tablename__ = "timeout_records"

    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("borrow_applications.id"), nullable=False)
    timeout_level = Column(Enum(TimeoutLevel), nullable=False)
    detected_at = Column(DateTime, default=datetime.now)
    overdue_hours = Column(Float, nullable=False)
    escalated_to = Column(String(200))
    escalation_message = Column(Text)
    is_handled = Column(Boolean, default=False)
    handled_by = Column(String(100))
    handled_at = Column(DateTime)
    handling_result = Column(Text)
    created_at = Column(DateTime, default=datetime.now)

    application = relationship("BorrowApplication", back_populates="timeout_records")


class StatusHistory(Base):
    __tablename__ = "status_histories"

    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("borrow_applications.id"), nullable=False)
    previous_status = Column(Enum(ApplicationStatus), nullable=True)
    new_status = Column(Enum(ApplicationStatus), nullable=False)
    previous_timeout_level = Column(Enum(TimeoutLevel), nullable=True)
    new_timeout_level = Column(Enum(TimeoutLevel), nullable=True)
    correction_type = Column(Enum(StatusCorrectionType), nullable=False, 
                              default=StatusCorrectionType.NORMAL_FLOW)
    operator = Column(String(100), nullable=False)
    operation_reason = Column(Text)
    operation_time = Column(DateTime, default=datetime.now)
    affected_fields = Column(JSON)
    previous_values = Column(JSON)
    new_values = Column(JSON)
    created_at = Column(DateTime, default=datetime.now)

    application = relationship("BorrowApplication", back_populates="status_histories")


class TaskExecutionLog(Base):
    __tablename__ = "task_execution_logs"

    id = Column(Integer, primary_key=True, index=True)
    task_name = Column(String(100), nullable=False)
    execution_time = Column(DateTime, default=datetime.now)
    status = Column(String(50), nullable=False)
    processed_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    error_message = Column(Text)
    retry_attempt = Column(Integer, default=0)
    next_retry_time = Column(DateTime, nullable=True)
    execution_details = Column(JSON)
    created_at = Column(DateTime, default=datetime.now)
