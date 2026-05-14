from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base
import datetime


class IdempotentRequest(Base):
    __tablename__ = "idempotent_requests"
    
    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(String(100), unique=True, index=True)
    endpoint = Column(String(200))
    request_data = Column(JSON)
    response_data = Column(JSON)
    status = Column(String(50), default="processing")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    completed_at = Column(DateTime)


class StudentProgress(Base):
    __tablename__ = "student_progress"
    
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(String(50), index=True)
    student_name = Column(String(100))
    course_id = Column(String(50), index=True)
    course_name = Column(String(200))
    overall_progress = Column(Float, default=0.0)
    total_chapters = Column(Integer, default=0)
    completed_chapters = Column(Integer, default=0)
    total_quizzes = Column(Integer, default=0)
    passed_quizzes = Column(Integer, default=0)
    start_date = Column(DateTime)
    last_activity_date = Column(DateTime)
    expected_completion_date = Column(DateTime)
    status = Column(String(50), default="in_progress")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    chapters = relationship("ChapterUnlock", back_populates="progress", cascade="all, delete-orphan")
    quizzes = relationship("QuizScore", back_populates="progress", cascade="all, delete-orphan")
    remedial_tasks = relationship("RemedialTask", back_populates="progress", cascade="all, delete-orphan")


class ChapterUnlock(Base):
    __tablename__ = "chapter_unlocks"
    
    id = Column(Integer, primary_key=True, index=True)
    progress_id = Column(Integer, ForeignKey("student_progress.id"))
    chapter_id = Column(String(50), index=True)
    chapter_name = Column(String(200))
    chapter_order = Column(Integer)
    is_unlocked = Column(Boolean, default=False)
    is_completed = Column(Boolean, default=False)
    unlock_date = Column(DateTime)
    completion_date = Column(DateTime)
    completion_percentage = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    progress = relationship("StudentProgress", back_populates="chapters")


class QuizScore(Base):
    __tablename__ = "quiz_scores"
    
    id = Column(Integer, primary_key=True, index=True)
    progress_id = Column(Integer, ForeignKey("student_progress.id"))
    quiz_id = Column(String(50), index=True)
    quiz_name = Column(String(200))
    chapter_id = Column(String(50))
    attempt_count = Column(Integer, default=0)
    highest_score = Column(Float, default=0.0)
    latest_score = Column(Float, default=0.0)
    passing_score = Column(Float, default=60.0)
    is_passed = Column(Boolean, default=False)
    first_attempt_date = Column(DateTime)
    latest_attempt_date = Column(DateTime)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    progress = relationship("StudentProgress", back_populates="quizzes")


class RemedialTask(Base):
    __tablename__ = "remedial_tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    progress_id = Column(Integer, ForeignKey("student_progress.id"))
    task_id = Column(String(50), index=True)
    task_name = Column(String(200))
    task_type = Column(String(50))
    reason = Column(String(500))
    is_abnormal = Column(Boolean, default=False)
    abnormal_reason = Column(Text)
    status = Column(String(50), default="pending")
    assigned_date = Column(DateTime)
    due_date = Column(DateTime)
    completion_date = Column(DateTime)
    reviewed_by = Column(String(100))
    review_notes = Column(Text)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    progress = relationship("StudentProgress", back_populates="remedial_tasks")


class CertificateEligibility(Base):
    __tablename__ = "certificate_eligibilities"
    
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(String(50), index=True)
    student_name = Column(String(100))
    course_id = Column(String(50), index=True)
    course_name = Column(String(200))
    is_eligible = Column(Boolean, default=False)
    eligibility_criteria = Column(JSON)
    manual_confirmation = Column(Boolean, default=False)
    confirmed_by = Column(String(100))
    confirmation_date = Column(DateTime)
    confirmation_notes = Column(Text)
    certificate_issued = Column(Boolean, default=False)
    certificate_issue_date = Column(DateTime)
    certificate_number = Column(String(100))
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)


class LearningReport(Base):
    __tablename__ = "learning_reports"
    
    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(String(50), unique=True, index=True)
    report_type = Column(String(50))
    report_name = Column(String(200))
    generated_by = Column(String(100))
    generated_at = Column(DateTime, default=datetime.datetime.utcnow)
    filters_applied = Column(JSON)
    file_path = Column(String(500))
    file_size = Column(Integer)
    record_count = Column(Integer)
    status = Column(String(50), default="completed")
    error_message = Column(Text)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class OperationLog(Base):
    __tablename__ = "operation_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    operation_type = Column(String(50), index=True)
    operator = Column(String(100))
    target_type = Column(String(50))
    target_id = Column(String(50))
    old_value = Column(JSON)
    new_value = Column(JSON)
    error_message = Column(Text)
    ip_address = Column(String(50))
    user_agent = Column(String(200))
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
