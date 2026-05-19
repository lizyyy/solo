from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum


class RiskStatus(str, enum.Enum):
    IDENTIFIED = "identified"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    MITIGATED = "mitigated"
    ESCALATED = "escalated"


class ReportStatus(str, enum.Enum):
    DRAFT = "draft"
    REVIEWING = "reviewing"
    APPROVED = "approved"
    SENT = "sent"


class DelayReasonStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    milestones = relationship("Milestone", back_populates="project", cascade="all, delete-orphan")
    risks = relationship("Risk", back_populates="project", cascade="all, delete-orphan")
    weekly_reports = relationship("WeeklyReport", back_populates="project", cascade="all, delete-orphan")


class Milestone(Base):
    __tablename__ = "milestones"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    planned_date = Column(DateTime(timezone=True), nullable=False)
    actual_date = Column(DateTime(timezone=True))
    status = Column(String(50), default="planned")
    original_input = Column(Text)
    processed_result = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    project = relationship("Project", back_populates="milestones")
    delay_reasons = relationship("DelayReason", back_populates="milestone", cascade="all, delete-orphan")


class Risk(Base):
    __tablename__ = "risks"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    status = Column(Enum(RiskStatus), default=RiskStatus.IDENTIFIED)
    owner = Column(String(100))
    owner_feedback = Column(Text)
    impact_level = Column(String(50))
    probability = Column(String(50))
    last_updated_by = Column(String(100))
    last_updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    update_token = Column(String(100), unique=True)

    project = relationship("Project", back_populates="risks")
    report_risks = relationship("ReportRisk", back_populates="risk", cascade="all, delete-orphan")


class WeeklyReport(Base):
    __tablename__ = "weekly_reports"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    version = Column(String(50), nullable=False)
    week_start = Column(DateTime(timezone=True), nullable=False)
    week_end = Column(DateTime(timezone=True), nullable=False)
    status = Column(Enum(ReportStatus), default=ReportStatus.DRAFT)
    summary = Column(Text)
    created_by = Column(String(100))
    reviewed_by = Column(String(100))
    review_comment = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    operation_id = Column(String(100), unique=True)

    project = relationship("Project", back_populates="weekly_reports")
    report_risks = relationship("ReportRisk", back_populates="weekly_report", cascade="all, delete-orphan")
    send_records = relationship("SendRecord", back_populates="weekly_report", cascade="all, delete-orphan")


class ReportRisk(Base):
    __tablename__ = "report_risks"

    id = Column(Integer, primary_key=True, index=True)
    weekly_report_id = Column(Integer, ForeignKey("weekly_reports.id"), nullable=False)
    risk_id = Column(Integer, ForeignKey("risks.id"), nullable=False)
    status_at_report = Column(String(50))
    owner_feedback_at_report = Column(Text)
    notes = Column(Text)

    weekly_report = relationship("WeeklyReport", back_populates="report_risks")
    risk = relationship("Risk", back_populates="report_risks")


class DelayReason(Base):
    __tablename__ = "delay_reasons"

    id = Column(Integer, primary_key=True, index=True)
    milestone_id = Column(Integer, ForeignKey("milestones.id"), nullable=False)
    weekly_report_id = Column(Integer, ForeignKey("weekly_reports.id"))
    reason = Column(Text, nullable=False)
    status = Column(Enum(DelayReasonStatus), default=DelayReasonStatus.PENDING)
    correction_path = Column(Text)
    review_comment = Column(Text)
    reviewed_by = Column(String(100))
    reviewed_at = Column(DateTime(timezone=True))
    created_by = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    version = Column(Integer, default=1)

    milestone = relationship("Milestone", back_populates="delay_reasons")
    weekly_report = relationship("WeeklyReport")


class SendRecord(Base):
    __tablename__ = "send_records"

    id = Column(Integer, primary_key=True, index=True)
    weekly_report_id = Column(Integer, ForeignKey("weekly_reports.id"), nullable=False)
    sent_to = Column(String(500), nullable=False)
    sent_by = Column(String(100))
    sent_at = Column(DateTime(timezone=True), server_default=func.now())
    subject = Column(String(200))
    content = Column(Text)
    operation_id = Column(String(100), unique=True)

    weekly_report = relationship("WeeklyReport", back_populates="send_records")
