from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Enum, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum


class DetectionStatus(str, enum.Enum):
    CREATED = "created"
    SCANNING = "scanning"
    SCANNED = "scanned"
    AUTH_CHECKING = "auth_checking"
    AUTH_CHECKED = "auth_checked"
    RISK_ASSESSING = "risk_assessing"
    RISK_ASSESSED = "risk_assessed"
    CONFIRMING_CLOSE = "confirming_close"
    CLOSED = "closed"
    CANCELLED = "cancelled"
    FAILED = "failed"


class RiskLevel(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class Environment(str, enum.Enum):
    DEV = "dev"
    TEST = "test"
    STAGING = "staging"
    PROD = "prod"


class AuthType(str, enum.Enum):
    NONE = "none"
    API_KEY = "api_key"
    JWT = "jwt"
    OAUTH2 = "oauth2"
    BASIC = "basic"


class ApiInventory(Base):
    __tablename__ = "api_inventory"

    id = Column(Integer, primary_key=True, index=True)
    api_path = Column(String, index=True, nullable=False)
    method = Column(String, nullable=False)
    service_name = Column(String, index=True)
    description = Column(Text)
    environment = Column(Enum(Environment), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    detections = relationship("DetectionTask", back_populates="api_inventory")


class DetectionTask(Base):
    __tablename__ = "detection_tasks"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(String, unique=True, index=True, nullable=False)
    api_inventory_id = Column(Integer, ForeignKey("api_inventory.id"))
    status = Column(Enum(DetectionStatus), default=DetectionStatus.CREATED)
    current_handler = Column(String)
    risk_level = Column(Enum(RiskLevel))
    risk_tags = Column(String)
    auth_type = Column(Enum(AuthType))
    auth_configured = Column(Boolean)
    scan_result = Column(Text)
    auth_check_result = Column(Text)
    risk_assessment_result = Column(Text)
    close_confirmation_result = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    completed_at = Column(DateTime(timezone=True))

    api_inventory = relationship("ApiInventory", back_populates="detections")
    history = relationship("DetectionHistory", back_populates="task", cascade="all, delete-orphan")
    close_record = relationship("CloseRecord", back_populates="task", uselist=False, cascade="all, delete-orphan")


class DetectionHistory(Base):
    __tablename__ = "detection_history"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("detection_tasks.id"))
    from_status = Column(Enum(DetectionStatus))
    to_status = Column(Enum(DetectionStatus))
    handler = Column(String)
    remark = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    task = relationship("DetectionTask", back_populates="history")


class CloseRecord(Base):
    __tablename__ = "close_records"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("detection_tasks.id"), unique=True)
    closed_by = Column(String, nullable=False)
    close_evidence = Column(Text)
    close_time = Column(DateTime(timezone=True), server_default=func.now())
    conclusion = Column(Text)

    task = relationship("DetectionTask", back_populates="close_record")


class InspectionReport(Base):
    __tablename__ = "inspection_reports"

    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(String, unique=True, index=True)
    start_time = Column(DateTime(timezone=True))
    end_time = Column(DateTime(timezone=True))
    total_apis = Column(Integer)
    high_risk_count = Column(Integer, default=0)
    medium_risk_count = Column(Integer, default=0)
    low_risk_count = Column(Integer, default=0)
    closed_count = Column(Integer, default=0)
    report_content = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
