from sqlalchemy import Column, Integer, String, Date, DateTime, Text, ForeignKey, Float, Enum, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base
import enum


class DeferralStatus(str, enum.Enum):
    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"
    RESCHEDULED = "rescheduled"
    COMPLETED = "completed"


class ExamStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    LOCKED = "locked"
    CONDUCTED = "conducted"
    GRADING = "grading"
    PUBLISHED = "published"
    CANCELLED = "cancelled"


class ScoreStatus(str, enum.Enum):
    EMPTY = "empty"
    PENDING = "pending"
    LOCKED = "locked"
    PUBLISHED = "published"
    RETAKED = "retaked"
    ABSENT = "absent"


class AuditAction(str, enum.Enum):
    SUBMIT = "submit"
    APPROVE = "approve"
    REJECT = "reject"
    CANCEL = "cancel"
    RESCHEDULE = "reschedule"
    SCORE_LOCK = "score_lock"
    SCORE_UNLOCK = "score_unlock"
    MAKEUP_CREATE = "makeup_create"
    RESCORE = "rescore"
    CORRECT = "correct"


class Student(Base):
    __tablename__ = "students"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    student_no = Column(String(20), unique=True, nullable=False)
    name = Column(String(50), nullable=False)
    class_name = Column(String(50))
    major = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Course(Base):
    __tablename__ = "courses"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    course_code = Column(String(20), unique=True, nullable=False)
    course_name = Column(String(100), nullable=False)
    credit = Column(Float, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class Exam(Base):
    __tablename__ = "exams"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    exam_type = Column(String(20), default="final")
    exam_date = Column(Date, nullable=False)
    start_time = Column(String(10), nullable=False)
    end_time = Column(String(10), nullable=False)
    classroom = Column(String(50))
    status = Column(Enum(ExamStatus), default=ExamStatus.SCHEDULED)
    is_makeup = Column(Boolean, default=False)
    related_original_exam_id = Column(Integer, ForeignKey("exams.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    course = relationship("Course", backref="exams")
    original_exam = relationship("Exam", remote_side=[id])


class DeferralApplication(Base):
    __tablename__ = "deferral_applications"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    exam_id = Column(Integer, ForeignKey("exams.id"), nullable=False)
    reason = Column(Text, nullable=False)
    reason_type = Column(String(50))
    evidence_url = Column(String(255))
    status = Column(Enum(DeferralStatus), default=DeferralStatus.DRAFT)
    reviewer_id = Column(Integer)
    review_comment = Column(Text)
    review_at = Column(DateTime)
    assigned_makeup_exam_id = Column(Integer, ForeignKey("exams.id"))
    batch_key = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    student = relationship("Student", backref="applications")
    exam = relationship("Exam", foreign_keys=[exam_id])
    makeup_exam = relationship("Exam", foreign_keys=[assigned_makeup_exam_id])


class Score(Base):
    __tablename__ = "scores"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    exam_id = Column(Integer, ForeignKey("exams.id"), nullable=False)
    score_value = Column(Float)
    score_status = Column(Enum(ScoreStatus), default=ScoreStatus.EMPTY)
    is_rescore = Column(Boolean, default=False)
    original_score_id = Column(Integer, ForeignKey("scores.id"))
    locked_by = Column(Integer)
    locked_at = Column(DateTime)
    published_at = Column(DateTime)
    recorded_by = Column(Integer)
    batch_key = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    student = relationship("Student", backref="scores")
    exam = relationship("Exam", backref="scores")
    original_score = relationship("Score", remote_side=[id])


class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    resource_type = Column(String(50), nullable=False)
    resource_id = Column(Integer, nullable=False)
    action = Column(Enum(AuditAction), nullable=False)
    operator_id = Column(Integer)
    operator_name = Column(String(50))
    old_value = Column(Text)
    new_value = Column(Text)
    comment = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
