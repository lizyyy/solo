from datetime import datetime
from enum import Enum
from sqlalchemy import (
    Column, Integer, String, DateTime, Boolean, Float, Text, 
    ForeignKey, JSON, Index
)
from sqlalchemy.orm import relationship

from app.database import Base


class StudentStatus(str, Enum):
    ACTIVE = "active"
    SUSPENDED = "suspended"
    GRADUATED = "graduated"
    DISMISSED = "dismissed"


class PreReviewStatus(str, Enum):
    PENDING = "pending"
    CALCULATING = "calculating"
    ELIGIBLE = "eligible"
    INELIGIBLE = "ineligible"
    MANUALLY_APPROVED = "manually_approved"
    MANUALLY_REJECTED = "manually_rejected"


class TaskStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    RETRYING = "retrying"


class RuleCategory(str, Enum):
    CREDITS = "credits"
    DISCIPLINE = "discipline"
    THESIS = "thesis"


class DisciplineLevel(str, Enum):
    WARNING = "warning"
    SERIOUS_WARNING = "serious_warning"
    DEMERIT = "demerit"
    PROBATION = "probation"
    EXPULSION = "expulsion"


class ThesisStatus(str, Enum):
    NOT_SUBMITTED = "not_submitted"
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    NEEDS_REVISION = "needs_revision"
    PASSED = "passed"
    FAILED = "failed"


class Student(Base):
    __tablename__ = "students"
    
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(String(20), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    department = Column(String(100), nullable=False)
    major = Column(String(100), nullable=False)
    grade = Column(Integer, nullable=False)
    status = Column(String(20), default=StudentStatus.ACTIVE.value)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    academic_records = relationship("AcademicRecord", back_populates="student", cascade="all, delete-orphan")
    disciplines = relationship("Discipline", back_populates="student", cascade="all, delete-orphan")
    theses = relationship("Thesis", back_populates="student", cascade="all, delete-orphan")
    pre_reviews = relationship("PreReview", back_populates="student", cascade="all, delete-orphan")
    history_records = relationship("HistoryRecord", back_populates="student", cascade="all, delete-orphan")


class AcademicRecord(Base):
    __tablename__ = "academic_records"
    
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    total_credits = Column(Float, default=0.0)
    required_credits_earned = Column(Float, default=0.0)
    elective_credits_earned = Column(Float, default=0.0)
    gpa = Column(Float, default=0.0)
    failed_courses_count = Column(Integer, default=0)
    courses_json = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    student = relationship("Student", back_populates="academic_records")


class Discipline(Base):
    __tablename__ = "disciplines"
    
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    level = Column(String(30), nullable=False)
    description = Column(Text, nullable=False)
    is_cleared = Column(Boolean, default=False)
    cleared_at = Column(DateTime, nullable=True)
    occurred_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    student = relationship("Student", back_populates="disciplines")


class Thesis(Base):
    __tablename__ = "theses"
    
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    title = Column(String(200))
    status = Column(String(30), default=ThesisStatus.NOT_SUBMITTED.value)
    submitted_at = Column(DateTime, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    score = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    student = relationship("Student", back_populates="theses")


class GraduationRule(Base):
    __tablename__ = "graduation_rules"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    category = Column(String(30), nullable=False)
    is_active = Column(Boolean, default=True)
    priority = Column(Integer, default=0)
    conditions_json = Column(JSON, nullable=False)
    description = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(String(100), default="system")


class RuleSnapshot(Base):
    __tablename__ = "rule_snapshots"
    
    id = Column(Integer, primary_key=True, index=True)
    snapshot_hash = Column(String(64), unique=True, index=True, nullable=False)
    rules_json = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(String(100), default="system")
    description = Column(Text)
    
    pre_reviews = relationship("PreReview", back_populates="rule_snapshot")


class PreReview(Base):
    __tablename__ = "pre_reviews"
    
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    rule_snapshot_id = Column(Integer, ForeignKey("rule_snapshots.id"), nullable=True)
    status = Column(String(30), default=PreReviewStatus.PENDING.value)
    is_eligible = Column(Boolean, nullable=True)
    calculated_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    student = relationship("Student", back_populates="pre_reviews")
    rule_snapshot = relationship("RuleSnapshot", back_populates="pre_reviews")
    missing_items = relationship("MissingItem", back_populates="pre_review", cascade="all, delete-orphan")
    review_actions = relationship("ReviewAction", back_populates="pre_review", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index('ix_pre_reviews_student_status', 'student_id', 'status'),
    )


class MissingItem(Base):
    __tablename__ = "missing_items"
    
    id = Column(Integer, primary_key=True, index=True)
    pre_review_id = Column(Integer, ForeignKey("pre_reviews.id"), nullable=False)
    rule_category = Column(String(30), nullable=False)
    rule_name = Column(String(100), nullable=False)
    error_code = Column(String(50), nullable=False)
    message = Column(Text, nullable=False)
    current_value = Column(JSON, nullable=True)
    required_value = Column(JSON, nullable=True)
    suggestion = Column(Text)
    is_resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    pre_review = relationship("PreReview", back_populates="missing_items")


class ReviewAction(Base):
    __tablename__ = "review_actions"
    
    id = Column(Integer, primary_key=True, index=True)
    pre_review_id = Column(Integer, ForeignKey("pre_reviews.id"), nullable=False)
    action_type = Column(String(30), nullable=False)
    previous_status = Column(String(30))
    new_status = Column(String(30))
    reason = Column(Text, nullable=False)
    operator = Column(String(100), default="system")
    created_at = Column(DateTime, default=datetime.utcnow)
    
    pre_review = relationship("PreReview", back_populates="review_actions")


class HistoryRecord(Base):
    __tablename__ = "history_records"
    
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    record_type = Column(String(50), nullable=False)
    before_data = Column(JSON, nullable=True)
    after_data = Column(JSON, nullable=True)
    change_reason = Column(Text)
    operator = Column(String(100), default="system")
    created_at = Column(DateTime, default=datetime.utcnow)
    
    student = relationship("Student", back_populates="history_records")
    
    __table_args__ = (
        Index('ix_history_records_student_type', 'student_id', 'record_type', 'created_at'),
    )


class BatchTask(Base):
    __tablename__ = "batch_tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(String(36), unique=True, index=True, nullable=False)
    task_type = Column(String(50), nullable=False)
    status = Column(String(30), default=TaskStatus.PENDING.value)
    parameters_json = Column(JSON, nullable=True)
    total_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(String(100), default="system")
    celery_task_id = Column(String(36), nullable=True)
    
    subtasks = relationship("BatchSubtask", back_populates="batch_task", cascade="all, delete-orphan")


class BatchSubtask(Base):
    __tablename__ = "batch_subtasks"
    
    id = Column(Integer, primary_key=True, index=True)
    batch_task_id = Column(Integer, ForeignKey("batch_tasks.id"), nullable=False)
    subtask_id = Column(String(36), unique=True, index=True, nullable=False)
    target_type = Column(String(30), nullable=False)
    target_id = Column(Integer, nullable=False)
    status = Column(String(30), default=TaskStatus.PENDING.value)
    error_message = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    batch_task = relationship("BatchTask", back_populates="subtasks")
