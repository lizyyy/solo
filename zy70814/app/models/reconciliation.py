from sqlalchemy import Column, String, Float, DateTime, Integer, Boolean, Text, ForeignKey, Enum
from sqlalchemy.orm import relationship
from app.models.base import BaseModel
import enum


class ReconciliationStatus(str, enum.Enum):
    PENDING = "pending"
    AUTO_CHECKED = "auto_checked"
    REVIEWING = "reviewing"
    APPROVED = "approved"
    REJECTED = "rejected"
    NEEDS_MORE_INFO = "needs_more_info"


class DiscrepancyType(str, enum.Enum):
    DRAFT_EXCEEDS_DEPTH = "draft_exceeds_depth"
    WINDOW_CONFLICT = "window_conflict"
    CUT_IN_DETECTED = "cut_in_detected"
    BERTH_UNAVAILABLE = "berth_unavailable"
    CROSS_DAY_WINDOW = "cross_day_window"
    TIDE_INSUFFICIENT = "tide_insufficient"
    VESSEL_LENGTH_EXCEEDED = "vessel_length_exceeded"
    CARGO_TYPE_RESTRICTED = "cargo_type_restricted"


class ReconciliationBatch(BaseModel):
    __tablename__ = "reconciliation_batches"

    batch_id = Column(String(100), unique=True, nullable=False, index=True)
    name = Column(String(255))
    
    vessel_schedule_file = Column(String(255))
    berth_file = Column(String(255))
    tide_file = Column(String(255))
    
    vessel_batch_id = Column(String(100), index=True)
    berth_batch_id = Column(String(100), index=True)
    tide_batch_id = Column(String(100), index=True)
    
    status = Column(String(50), default=ReconciliationStatus.PENDING)
    total_records = Column(Integer, default=0)
    passed_records = Column(Integer, default=0)
    failed_records = Column(Integer, default=0)
    warning_records = Column(Integer, default=0)
    
    checked_at = Column(DateTime)
    reviewed_at = Column(DateTime)
    approved_at = Column(DateTime)
    
    created_by = Column(String(100))
    reviewed_by = Column(String(100))
    approved_by = Column(String(100))
    
    notes = Column(Text)


class ReconciliationRecord(BaseModel):
    __tablename__ = "reconciliation_records"

    batch_id = Column(String(100), index=True, nullable=False)
    vessel_schedule_id = Column(Integer, ForeignKey("vessel_schedules.id"))
    berth_id = Column(Integer, ForeignKey("berths.id"))
    
    vessel_name = Column(String(100), nullable=False)
    vessel_imo = Column(String(20))
    voyage_number = Column(String(50))
    berth_number = Column(String(20))
    
    draft = Column(Float)
    available_depth = Column(Float)
    depth_margin = Column(Float)
    
    arrival_time = Column(DateTime)
    departure_time = Column(DateTime)
    planned_berth_time = Column(DateTime)
    
    status = Column(String(50), default=ReconciliationStatus.PENDING)
    has_discrepancy = Column(Boolean, default=False)
    discrepancy_count = Column(Integer, default=0)
    
    is_reviewed = Column(Boolean, default=False)
    reviewed_by = Column(String(100))
    reviewed_at = Column(DateTime)
    review_notes = Column(Text)
    
    review_decision = Column(String(50))
    override_reason = Column(Text)
    
    original_data_hash = Column(String(64))
    current_data_hash = Column(String(64))
    
    vessel_schedule = relationship("VesselSchedule", back_populates="reconciliation_records")
    berth = relationship("Berth", back_populates="reconciliation_records")
    discrepancies = relationship("DiscrepancyLog", back_populates="record", cascade="all, delete-orphan")
    review_history = relationship("ReviewHistory", back_populates="record", cascade="all, delete-orphan")


class DiscrepancyLog(BaseModel):
    __tablename__ = "discrepancy_logs"

    record_id = Column(Integer, ForeignKey("reconciliation_records.id"), index=True)
    batch_id = Column(String(100), index=True)
    record = relationship("ReconciliationRecord", back_populates="discrepancies")
    
    discrepancy_type = Column(String(50), nullable=False)
    severity = Column(String(20), default="warning")
    
    field_name = Column(String(100))
    expected_value = Column(String(255))
    actual_value = Column(String(255))
    
    description = Column(Text)
    explanation = Column(Text)
    
    source = Column(String(100))
    is_resolved = Column(Boolean, default=False)
    resolved_by = Column(String(100))
    resolved_at = Column(DateTime)
    resolution_notes = Column(Text)


class ReviewHistory(BaseModel):
    __tablename__ = "review_history"

    record_id = Column(Integer, ForeignKey("reconciliation_records.id"), index=True)
    batch_id = Column(String(100), index=True)
    record = relationship("ReconciliationRecord", back_populates="review_history")
    
    action = Column(String(50), nullable=False)
    previous_status = Column(String(50))
    new_status = Column(String(50))
    
    reviewer = Column(String(100))
    review_notes = Column(Text)
    
    field_changes = Column(Text)
    data_snapshot = Column(Text)
