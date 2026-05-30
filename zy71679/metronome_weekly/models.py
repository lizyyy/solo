from datetime import datetime
from sqlalchemy import Column, Integer, Float, String, DateTime, Boolean, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from database import Base


class Student(Base):
    __tablename__ = "students"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    instrument = Column(String(50), default="drums")
    enrolled_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    practice_records = relationship("PracticeRecord", back_populates="student")
    comments = relationship("TeacherComment", back_populates="student")


class PracticeRecord(Base):
    __tablename__ = "practice_records"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    practiced_at = Column(DateTime, nullable=False)
    bpm = Column(Integer, nullable=False)
    duration_seconds = Column(Integer, nullable=False)
    time_signature = Column(String(10), default="4/4")
    raw_deviations = Column(JSON, default=list)
    mean_deviation_ms = Column(Float, default=0.0)
    max_deviation_ms = Column(Float, default=0.0)
    weak_beat_deviations = Column(JSON, default=list)
    strong_beat_deviations = Column(JSON, default=list)
    is_backdated = Column(Boolean, default=False)
    is_duplicate_flagged = Column(Boolean, default=False)
    confirmation_status = Column(String(20), default="pending")
    confirmed_by = Column(String(100), nullable=True)
    confirmed_at = Column(DateTime, nullable=True)
    bpm_change_segments = Column(JSON, default=list)
    missing_segment_flagged = Column(Boolean, default=False)
    weak_beat_misjudgment_flagged = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    student = relationship("Student", back_populates="practice_records")
    confirmations = relationship("ConfirmationRecord", back_populates="practice_record")


class TeacherComment(Base):
    __tablename__ = "teacher_comments"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    week_start = Column(DateTime, nullable=False)
    week_end = Column(DateTime, nullable=False)
    content = Column(Text, nullable=False)
    version = Column(Integer, default=1)
    supersedes_id = Column(Integer, ForeignKey("teacher_comments.id"), nullable=True)
    is_current = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    student = relationship("Student", back_populates="comments")
    superseded_by = relationship("TeacherComment", remote_side=[supersedes_id])


class WeeklyReport(Base):
    __tablename__ = "weekly_reports"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    week_start = Column(DateTime, nullable=False)
    week_end = Column(DateTime, nullable=False)
    total_practice_sessions = Column(Integer, default=0)
    total_duration_seconds = Column(Integer, default=0)
    avg_deviation_ms = Column(Float, default=0.0)
    best_deviation_ms = Column(Float, default=0.0)
    bpm_range = Column(JSON, default=dict)
    segment_summary = Column(JSON, default=list)
    progress_interpretation = Column(JSON, default=dict)
    comment_id = Column(Integer, ForeignKey("teacher_comments.id"), nullable=True)
    export_format = Column(String(20), default="json")
    generated_at = Column(DateTime, default=datetime.utcnow)


class ConfirmationRecord(Base):
    __tablename__ = "confirmation_records"
    id = Column(Integer, primary_key=True, index=True)
    practice_record_id = Column(Integer, ForeignKey("practice_records.id"), nullable=False)
    action = Column(String(20), nullable=False)
    previous_status = Column(String(20), nullable=False)
    new_status = Column(String(20), nullable=False)
    operator = Column(String(100), nullable=False)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    practice_record = relationship("PracticeRecord", back_populates="confirmations")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(Integer, nullable=False)
    action = Column(String(50), nullable=False)
    before_state = Column(JSON, nullable=True)
    after_state = Column(JSON, nullable=True)
    operator = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
