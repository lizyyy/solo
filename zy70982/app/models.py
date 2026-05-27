from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from .database import Base


class DataSource(str, enum.Enum):
    ALARM = "alarm"
    INSPECTION = "inspection"
    WORK_ORDER = "work_order"


class DiscrepancyType(str, enum.Enum):
    MISSING_ALARM = "missing_alarm"
    MISSING_INSPECTION = "missing_inspection"
    MISSING_WORK_ORDER = "missing_work_order"
    FALSE_ALARM = "false_alarm"
    MULTI_LIGHT_SAME_POLE = "multi_light_same_pole"
    REPAIR_RETEST = "repair_retest"
    STATUS_MISMATCH = "status_mismatch"
    TIME_MISMATCH = "time_mismatch"


class ReviewStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    NEEDS_MORE_INFO = "needs_more_info"


class ReconciliationStatus(str, enum.Enum):
    MATCHED = "matched"
    DISCREPANCY = "discrepancy"
    REVIEWED = "reviewed"


class Alarm(Base):
    __tablename__ = "alarms"

    id = Column(Integer, primary_key=True, index=True)
    alarm_id = Column(String, unique=True, index=True)
    pole_id = Column(String, index=True)
    light_id = Column(String, index=True)
    alarm_type = Column(String)
    alarm_level = Column(String)
    alarm_time = Column(DateTime)
    description = Column(Text)
    status = Column(String)
    source_file = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_false_alarm = Column(Boolean, default=False)
    false_alarm_reason = Column(Text, nullable=True)

    reconciliation_records = relationship("ReconciliationRecord", back_populates="alarm")


class Inspection(Base):
    __tablename__ = "inspections"

    id = Column(Integer, primary_key=True, index=True)
    inspection_id = Column(String, unique=True, index=True)
    pole_id = Column(String, index=True)
    light_id = Column(String, index=True)
    inspector = Column(String)
    inspection_time = Column(DateTime)
    status = Column(String)
    issues_found = Column(Text)
    photos = Column(Text, nullable=True)
    source_file = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    reconciliation_records = relationship("ReconciliationRecord", back_populates="inspection")


class WorkOrder(Base):
    __tablename__ = "work_orders"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(String, unique=True, index=True)
    pole_id = Column(String, index=True)
    light_id = Column(String, index=True)
    alarm_id = Column(String, nullable=True)
    repair_type = Column(String)
    reporter = Column(String)
    report_time = Column(DateTime)
    repairer = Column(String, nullable=True)
    repair_time = Column(DateTime, nullable=True)
    repair_content = Column(Text, nullable=True)
    status = Column(String)
    is_retest = Column(Boolean, default=False)
    retest_result = Column(String, nullable=True)
    source_file = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    reconciliation_records = relationship("ReconciliationRecord", back_populates="work_order")


class ReconciliationRecord(Base):
    __tablename__ = "reconciliation_records"

    id = Column(Integer, primary_key=True, index=True)
    reconciliation_id = Column(String, index=True)
    pole_id = Column(String, index=True)
    light_id = Column(String, index=True)

    alarm_id = Column(Integer, ForeignKey("alarms.id"), nullable=True)
    inspection_id = Column(Integer, ForeignKey("inspections.id"), nullable=True)
    work_order_id = Column(Integer, ForeignKey("work_orders.id"), nullable=True)

    status = Column(Enum(ReconciliationStatus), default=ReconciliationStatus.DISCREPANCY)
    review_status = Column(Enum(ReviewStatus), default=ReviewStatus.PENDING)

    alarm = relationship("Alarm", back_populates="reconciliation_records")
    inspection = relationship("Inspection", back_populates="reconciliation_records")
    work_order = relationship("WorkOrder", back_populates="reconciliation_records")

    discrepancies = relationship("Discrepancy", back_populates="record", cascade="all, delete-orphan")
    review_histories = relationship("ReviewHistory", back_populates="record", cascade="all, delete-orphan")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Discrepancy(Base):
    __tablename__ = "discrepancies"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(Integer, ForeignKey("reconciliation_records.id"))
    type = Column(Enum(DiscrepancyType))
    description = Column(Text)
    source = Column(Enum(DataSource))
    is_resolved = Column(Boolean, default=False)
    resolved_reason = Column(Text, nullable=True)

    record = relationship("ReconciliationRecord", back_populates="discrepancies")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ReviewHistory(Base):
    __tablename__ = "review_histories"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(Integer, ForeignKey("reconciliation_records.id"))
    reviewer = Column(String)
    review_time = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(Enum(ReviewStatus))
    comment = Column(Text)
    explanation = Column(Text)

    record = relationship("ReconciliationRecord", back_populates="review_histories")


class ReconciliationBatch(Base):
    __tablename__ = "reconciliation_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String, unique=True, index=True)
    name = Column(String)
    description = Column(Text, nullable=True)
    status = Column(String, default="processing")
    total_records = Column(Integer, default=0)
    matched_count = Column(Integer, default=0)
    discrepancy_count = Column(Integer, default=0)
    reviewed_count = Column(Integer, default=0)
    created_by = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
