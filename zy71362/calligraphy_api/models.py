from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Text, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from database import Base


class Homework(Base):
    __tablename__ = "homeworks"

    id = Column(Integer, primary_key=True, index=True)
    student_name = Column(String(100), nullable=False)
    font_type = Column(String(50), nullable=False)
    image_path = Column(String(500), nullable=False)
    original_image_path = Column(String(500), nullable=True)
    status = Column(String(50), default="uploaded")
    tilt_angle = Column(Float, nullable=True)
    tilt_corrected = Column(Boolean, default=False)
    class_name = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    score_reports = relationship("ScoreReport", back_populates="homework", cascade="all, delete-orphan")
    comments = relationship("Comment", back_populates="homework", cascade="all, delete-orphan")
    measurements = relationship("LayoutMeasurement", back_populates="homework", cascade="all, delete-orphan")
    issues = relationship("IssueRecord", back_populates="homework", cascade="all, delete-orphan")


class ScoreReport(Base):
    __tablename__ = "score_reports"

    id = Column(Integer, primary_key=True, index=True)
    homework_id = Column(Integer, ForeignKey("homeworks.id"), nullable=False)
    char_spacing_score = Column(Float, default=0.0)
    line_spacing_score = Column(Float, default=0.0)
    signature_position_score = Column(Float, default=0.0)
    total_score = Column(Float, default=0.0)
    is_manual_override = Column(Boolean, default=False)
    override_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    homework = relationship("Homework", back_populates="score_reports")


class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    homework_id = Column(Integer, ForeignKey("homeworks.id"), nullable=False)
    teacher_comment = Column(Text, nullable=False)
    comment_type = Column(String(50), default="general")
    created_at = Column(DateTime, default=datetime.utcnow)

    homework = relationship("Homework", back_populates="comments")


class LayoutMeasurement(Base):
    __tablename__ = "layout_measurements"

    id = Column(Integer, primary_key=True, index=True)
    homework_id = Column(Integer, ForeignKey("homeworks.id"), nullable=False)
    char_distances = Column(JSON, default=list)
    line_distances = Column(JSON, default=list)
    avg_char_spacing = Column(Float, default=0.0)
    avg_line_spacing = Column(Float, default=0.0)
    char_spacing_variance = Column(Float, default=0.0)
    line_spacing_variance = Column(Float, default=0.0)
    signature_detected = Column(Boolean, default=False)
    signature_region = Column(JSON, nullable=True)
    row_count = Column(Integer, default=0)
    char_count = Column(Integer, default=0)
    is_manual_adjusted = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    homework = relationship("Homework", back_populates="measurements")


class IssueRecord(Base):
    __tablename__ = "issue_records"

    id = Column(Integer, primary_key=True, index=True)
    homework_id = Column(Integer, ForeignKey("homeworks.id"), nullable=False)
    issue_type = Column(String(50), nullable=False)
    severity = Column(String(20), default="medium")
    description = Column(Text, nullable=False)
    suggested_action = Column(Text, nullable=True)
    resolution = Column(Text, nullable=True)
    resolved = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

    homework = relationship("Homework", back_populates="issues")
