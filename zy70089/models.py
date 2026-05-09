from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean, ForeignKey, Date, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base
import enum


class PollutantType(enum.Enum):
    WATER = "water"
    AIR = "air"
    NOISE = "noise"
    SOLID_WASTE = "solid_waste"


class DetectionStatus(enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class OverlimitStatus(enum.Enum):
    IDENTIFIED = "identified"
    RECTIFYING = "rectifying"
    REVIEWED = "reviewed"
    RESOLVED = "resolved"


class RectificationStatus(enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"


class Permission(Base):
    __tablename__ = "permissions"

    id = Column(Integer, primary_key=True, index=True)
    permit_no = Column(String(64), unique=True, index=True, nullable=False)
    enterprise_name = Column(String(255), nullable=False)
    pollutant_type = Column(SQLEnum(PollutantType), nullable=False)
    pollutant_name = Column(String(128), nullable=False)
    
    limit_value = Column(Float, nullable=False)
    limit_unit = Column(String(32), nullable=False)
    
    effective_date = Column(Date, nullable=False)
    expiry_date = Column(Date, nullable=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    detection_reports = relationship("DetectionReport", back_populates="permission")
    overlimit_records = relationship("OverlimitRecord", back_populates="permission")


class DetectionReport(Base):
    __tablename__ = "detection_reports"

    id = Column(Integer, primary_key=True, index=True)
    report_no = Column(String(64), unique=True, index=True, nullable=False)
    permission_id = Column(Integer, ForeignKey("permissions.id"), nullable=False)
    
    detection_date = Column(DateTime, nullable=False)
    detection_value = Column(Float, nullable=False)
    detection_unit = Column(String(32), nullable=False)
    
    detection_method = Column(String(255))
    lab_name = Column(String(255))
    operator = Column(String(128))
    
    status = Column(SQLEnum(DetectionStatus), default=DetectionStatus.COMPLETED)
    is_overlimit = Column(Boolean, default=False)
    
    remark = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    permission = relationship("Permission", back_populates="detection_reports")
    overlimit_records = relationship("OverlimitRecord", back_populates="detection_report")


class OverlimitRecord(Base):
    __tablename__ = "overlimit_records"

    id = Column(Integer, primary_key=True, index=True)
    permission_id = Column(Integer, ForeignKey("permissions.id"), nullable=False)
    detection_report_id = Column(Integer, ForeignKey("detection_reports.id"), nullable=False, unique=True)
    
    overlimit_value = Column(Float, nullable=False)
    overlimit_ratio = Column(Float, nullable=False)
    
    detection_date = Column(DateTime, nullable=False)
    identification_date = Column(DateTime, default=datetime.utcnow)
    
    status = Column(SQLEnum(OverlimitStatus), default=OverlimitStatus.IDENTIFIED)
    
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    permission = relationship("Permission", back_populates="overlimit_records")
    detection_report = relationship("DetectionReport", back_populates="overlimit_records")
    rectification_task = relationship("RectificationTask", back_populates="overlimit_record", uselist=False)


class RectificationTask(Base):
    __tablename__ = "rectification_tasks"

    id = Column(Integer, primary_key=True, index=True)
    overlimit_record_id = Column(Integer, ForeignKey("overlimit_records.id"), nullable=False, unique=True)
    
    task_no = Column(String(64), unique=True, index=True, nullable=False)
    
    deadline = Column(DateTime, nullable=False)
    actual_completion_date = Column(DateTime)
    
    rectification_measures = Column(Text)
    responsible_person = Column(String(128))
    contact_info = Column(String(255))
    
    status = Column(SQLEnum(RectificationStatus), default=RectificationStatus.PENDING)
    
    remark = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    overlimit_record = relationship("OverlimitRecord", back_populates="rectification_task")
    review_receipts = relationship("ReviewReceipt", back_populates="rectification_task")
    supervision_reports = relationship("SupervisionReport", back_populates="rectification_task")


class ReviewReceipt(Base):
    __tablename__ = "review_receipts"

    id = Column(Integer, primary_key=True, index=True)
    rectification_task_id = Column(Integer, ForeignKey("rectification_tasks.id"), nullable=False)
    
    receipt_no = Column(String(64), unique=True, index=True, nullable=False)
    review_date = Column(DateTime, nullable=False)
    
    reviewer = Column(String(128))
    review_organization = Column(String(255))
    
    review_result = Column(Boolean, default=False)
    review_comment = Column(Text)
    
    redetection_value = Column(Float)
    redetection_unit = Column(String(32))
    is_qualified = Column(Boolean, default=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    rectification_task = relationship("RectificationTask", back_populates="review_receipts")


class SupervisionReport(Base):
    __tablename__ = "supervision_reports"

    id = Column(Integer, primary_key=True, index=True)
    rectification_task_id = Column(Integer, ForeignKey("rectification_tasks.id"), nullable=False)
    
    report_no = Column(String(64), unique=True, index=True, nullable=False)
    report_date = Column(DateTime, default=datetime.utcnow)
    
    reporter = Column(String(128))
    report_organization = Column(String(255))
    
    supervision_content = Column(Text)
    supervision_result = Column(Text)
    suggestion = Column(Text)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    rectification_task = relationship("RectificationTask", back_populates="supervision_reports")


class ImportLock(Base):
    __tablename__ = "import_locks"

    id = Column(Integer, primary_key=True, index=True)
    lock_key = Column(String(128), unique=True, index=True, nullable=False)
    held_by = Column(String(64))
    acquired_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
