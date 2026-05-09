from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, Enum as SQLEnum, Float
from sqlalchemy.orm import relationship
from datetime import datetime
from enum import Enum
from .database import Base


class InspectionStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class RectificationStatus(str, Enum):
    ASSIGNED = "assigned"
    RECTIFYING = "rectifying"
    SUBMITTED = "submitted"
    RECHECKING = "rechecking"
    PASSED = "passed"
    REJECTED = "rejected"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"


class PhotoType(str, Enum):
    ISSUE = "issue"
    RECTIFICATION = "rectification"
    RECHECK = "recheck"


class Store(Base):
    __tablename__ = "stores"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    code = Column(String(50), unique=True, index=True, nullable=False)
    region = Column(String(100), index=True)
    city = Column(String(100))
    address = Column(String(500))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    inspections = relationship("Inspection", back_populates="store")


class InspectionItem(Base):
    __tablename__ = "inspection_items"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    code = Column(String(50), unique=True, index=True, nullable=False)
    category = Column(String(100), index=True)
    description = Column(Text)
    base_score = Column(Float, default=10.0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    inspection_records = relationship("InspectionRecord", back_populates="item")


class Inspection(Base):
    __tablename__ = "inspections"

    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    inspector = Column(String(100))
    inspection_date = Column(DateTime, default=datetime.utcnow)
    status = Column(SQLEnum(InspectionStatus), default=InspectionStatus.PENDING, index=True)
    remark = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    store = relationship("Store", back_populates="inspections")
    records = relationship("InspectionRecord", back_populates="inspection", cascade="all, delete-orphan")


class InspectionRecord(Base):
    __tablename__ = "inspection_records"

    id = Column(Integer, primary_key=True, index=True)
    inspection_id = Column(Integer, ForeignKey("inspections.id"), nullable=False)
    item_id = Column(Integer, ForeignKey("inspection_items.id"), nullable=False)
    is_pass = Column(Boolean, default=True)
    score = Column(Float, default=0.0)
    deduction = Column(Float, default=0.0)
    deduction_reason = Column(Text)
    remark = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    inspection = relationship("Inspection", back_populates="records")
    item = relationship("InspectionItem", back_populates="inspection_records")
    photos = relationship("PhotoEvidence", back_populates="record", cascade="all, delete-orphan")
    rectifications = relationship("Rectification", back_populates="record", cascade="all, delete-orphan")


class Rectification(Base):
    __tablename__ = "rectifications"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(Integer, ForeignKey("inspection_records.id"), nullable=False)
    assignee = Column(String(100), index=True)
    status = Column(SQLEnum(RectificationStatus), default=RectificationStatus.ASSIGNED, index=True)
    deadline = Column(DateTime, nullable=False)
    rectification_description = Column(Text)
    rectification_at = Column(DateTime)
    rechecker = Column(String(100))
    recheck_result = Column(String(100))
    recheck_remark = Column(Text)
    recheck_at = Column(DateTime)
    final_score = Column(Float)
    final_deduction = Column(Float, default=0.0)
    retry_count = Column(Integer, default=0)
    parent_id = Column(Integer, ForeignKey("rectifications.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    record = relationship("InspectionRecord", back_populates="rectifications")
    photos = relationship("PhotoEvidence", back_populates="rectification", cascade="all, delete-orphan")
    children = relationship("Rectification", backref="parent", remote_side=[id])
    events = relationship("RectificationEvent", back_populates="rectification", cascade="all, delete-orphan")


class PhotoEvidence(Base):
    __tablename__ = "photo_evidences"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(Integer, ForeignKey("inspection_records.id"), nullable=True)
    rectification_id = Column(Integer, ForeignKey("rectifications.id"), nullable=True)
    photo_type = Column(SQLEnum(PhotoType), nullable=False, index=True)
    file_path = Column(String(500), nullable=False)
    file_name = Column(String(200))
    description = Column(Text)
    uploaded_by = Column(String(100))
    upload_time = Column(DateTime, default=datetime.utcnow)

    record = relationship("InspectionRecord", back_populates="photos")
    rectification = relationship("Rectification", back_populates="photos")


class RectificationEvent(Base):
    __tablename__ = "rectification_events"

    id = Column(Integer, primary_key=True, index=True)
    rectification_id = Column(Integer, ForeignKey("rectifications.id"), nullable=False)
    event_type = Column(String(50), index=True)
    from_status = Column(SQLEnum(RectificationStatus), nullable=True)
    to_status = Column(SQLEnum(RectificationStatus), nullable=False)
    actor = Column(String(100))
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    rectification = relationship("Rectification", back_populates="events")


class DeductionRule(Base):
    __tablename__ = "deduction_rules"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    item_category = Column(String(100), index=True)
    level = Column(Integer, index=True)
    base_deduction = Column(Float, default=0.0)
    overdue_multiplier = Column(Float, default=1.0)
    retry_penalty = Column(Float, default=0.0)
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
