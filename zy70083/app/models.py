from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean, Enum
from sqlalchemy.orm import relationship as sa_relationship
from sqlalchemy.sql import func
from .database import Base
import enum


class ApplicationStatus(enum.Enum):
    CREATED = "created"
    UNDER_REVIEW = "under_review"
    INCOME_VERIFICATION = "income_verification"
    SOCIAL_INSURANCE_VERIFICATION = "social_insurance_verification"
    HOUSING_STATUS_VERIFICATION = "housing_status_verification"
    VERIFIED = "verified"
    REJECTED = "rejected"
    LOTTERY_LOCKED = "lottery_locked"
    PUBLIC_ANNOUNCEMENT = "public_announcement"
    OBJECTION_RAISED = "objection_raised"
    OBJECTION_RESOLVED = "objection_resolved"
    FINAL_RESULT = "final_result"


class TaskStatus(enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    RETRY = "retry"


class QualificationRule(Base):
    __tablename__ = "qualification_rules"

    id = Column(Integer, primary_key=True, index=True)
    rule_name = Column(String(100), nullable=False)
    rule_type = Column(String(50), nullable=False)
    version = Column(Integer, default=1)
    is_active = Column(Boolean, default=True)
    description = Column(Text, nullable=True)

    min_income_threshold = Column(Float, nullable=True)
    max_income_threshold = Column(Float, nullable=True)
    min_social_insurance_months = Column(Integer, nullable=True)
    max_housing_area_per_person = Column(Float, nullable=True)
    max_family_housing_area = Column(Float, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class ApplicationRecord(Base):
    __tablename__ = "application_records"

    id = Column(Integer, primary_key=True, index=True)
    application_number = Column(String(50), unique=True, nullable=False)
    applicant_name = Column(String(100), nullable=False)
    applicant_id_card = Column(String(18), nullable=False)
    contact_phone = Column(String(20), nullable=False)
    household_address = Column(String(200), nullable=False)

    current_status = Column(String(50), default=ApplicationStatus.CREATED.value)
    current_checkpoint = Column(String(100), nullable=True)
    rejection_reason = Column(Text, nullable=True)

    applied_rule_id = Column(Integer, ForeignKey("qualification_rules.id"), nullable=True)
    applied_rule = sa_relationship("QualificationRule")

    family_members = sa_relationship("FamilyMember", back_populates="application_record", cascade="all, delete-orphan")
    verification_records = sa_relationship("VerificationRecord", back_populates="application_record", cascade="all, delete-orphan")
    processing_history = sa_relationship("ProcessingHistory", back_populates="application_record", cascade="all, delete-orphan")

    lottery_locked_at = Column(DateTime(timezone=True), nullable=True)
    lottery_pool_id = Column(String(50), nullable=True)
    public_announcement_at = Column(DateTime(timezone=True), nullable=True)
    final_result = Column(String(20), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class FamilyMember(Base):
    __tablename__ = "family_members"

    id = Column(Integer, primary_key=True, index=True)
    application_record_id = Column(Integer, ForeignKey("application_records.id"), nullable=False)

    name = Column(String(100), nullable=False)
    id_card = Column(String(18), nullable=False)
    relation = Column(String(50), nullable=False)
    is_main_applicant = Column(Boolean, default=False)

    monthly_income = Column(Float, nullable=True)
    social_insurance_months = Column(Integer, nullable=True)
    housing_area_contribution = Column(Float, nullable=True)

    application_record = sa_relationship("ApplicationRecord", back_populates="family_members")


class VerificationRecord(Base):
    __tablename__ = "verification_records"

    id = Column(Integer, primary_key=True, index=True)
    application_record_id = Column(Integer, ForeignKey("application_records.id"), nullable=False)

    verification_type = Column(String(50), nullable=False)
    verification_status = Column(String(20), default="pending")
    verification_result = Column(String(20), nullable=True)
    verification_message = Column(Text, nullable=True)

    details = Column(Text, nullable=True)
    verified_by = Column(String(50), nullable=True)
    verified_at = Column(DateTime(timezone=True), server_default=func.now())

    application_record = sa_relationship("ApplicationRecord", back_populates="verification_records")


class ProcessingHistory(Base):
    __tablename__ = "processing_history"

    id = Column(Integer, primary_key=True, index=True)
    application_record_id = Column(Integer, ForeignKey("application_records.id"), nullable=False)

    previous_status = Column(String(50), nullable=True)
    new_status = Column(String(50), nullable=False)
    checkpoint = Column(String(100), nullable=True)
    action = Column(String(100), nullable=False)
    operator = Column(String(50), nullable=True)
    remark = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    application_record = sa_relationship("ApplicationRecord", back_populates="processing_history")


class BackgroundTask(Base):
    __tablename__ = "background_tasks"

    id = Column(Integer, primary_key=True, index=True)
    task_name = Column(String(100), nullable=False)
    task_type = Column(String(50), nullable=False)
    application_record_id = Column(Integer, ForeignKey("application_records.id"), nullable=True)

    status = Column(String(20), default=TaskStatus.PENDING.value)
    progress = Column(Integer, default=0)
    max_retry = Column(Integer, default=3)
    retry_count = Column(Integer, default=0)

    error_message = Column(Text, nullable=True)
    last_error_at = Column(DateTime(timezone=True), nullable=True)
    last_success_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class LotteryPool(Base):
    __tablename__ = "lottery_pools"

    id = Column(Integer, primary_key=True, index=True)
    pool_id = Column(String(50), unique=True, nullable=False)
    pool_name = Column(String(100), nullable=False)
    lottery_year = Column(Integer, nullable=False)
    lottery_batch = Column(Integer, nullable=False)

    total_quota = Column(Integer, nullable=False)
    locked_count = Column(Integer, default=0)
    selected_count = Column(Integer, default=0)

    is_active = Column(Boolean, default=True)
    announcement_date = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ObjectionRecord(Base):
    __tablename__ = "objection_records"

    id = Column(Integer, primary_key=True, index=True)
    application_record_id = Column(Integer, ForeignKey("application_records.id"), nullable=False)

    objector_name = Column(String(100), nullable=False)
    objector_contact = Column(String(20), nullable=False)
    objection_content = Column(Text, nullable=False)
    objection_date = Column(DateTime(timezone=True), server_default=func.now())

    handling_status = Column(String(20), default="pending")
    handling_remark = Column(Text, nullable=True)
    handling_result = Column(String(20), nullable=True)
    handled_at = Column(DateTime(timezone=True), nullable=True)
