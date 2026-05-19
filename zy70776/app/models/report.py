from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum, Boolean
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.checklist import MissingLevel


class ReportStatus(str, Enum):
    GENERATED = "generated"
    MANUALLY_FIXED = "manually_fixed"


class CheckReport(Base):
    __tablename__ = "check_reports"

    id = Column(Integer, primary_key=True, index=True)
    checklist_id = Column(Integer, ForeignKey("release_checklists.id"), nullable=False)
    report_no = Column(String, unique=True, index=True, nullable=False)
    status = Column(String, default=ReportStatus.GENERATED)
    generated_at = Column(DateTime, default=datetime.utcnow)
    generated_by = Column(String)
    total_issues = Column(Integer, default=0)
    critical_count = Column(Integer, default=0)
    high_count = Column(Integer, default=0)
    medium_count = Column(Integer, default=0)
    low_count = Column(Integer, default=0)
    summary = Column(Text)

    checklist = relationship("ReleaseChecklist", back_populates="reports")
    items = relationship("CheckReportItem", back_populates="report", cascade="all, delete-orphan")


class CheckReportItem(Base):
    __tablename__ = "check_report_items"

    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(Integer, ForeignKey("check_reports.id"), nullable=False)
    missing_level = Column(Enum(MissingLevel), nullable=False)
    category = Column(String, nullable=False)
    item_name = Column(String, nullable=False)
    description = Column(Text)
    owner = Column(String)
    fixed = Column(Boolean, default=False)
    fixed_at = Column(DateTime)
    fixed_by = Column(String)
    fix_note = Column(Text)

    report = relationship("CheckReport", back_populates="items")
