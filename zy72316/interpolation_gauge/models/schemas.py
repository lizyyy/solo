import enum
from datetime import datetime
from sqlalchemy import Column, Integer, Float, String, Text, DateTime, Enum, ForeignKey, JSON
from sqlalchemy.orm import relationship
from interpolation_gauge.database import Base


class ProcessingStatus(str, enum.Enum):
    PENDING = "pending"
    REVIEWING = "reviewing"
    BOUNDARY_PENDING_REVIEW = "boundary_pending_review"
    CONFIRMED = "confirmed"
    ROLLED_BACK = "rolled_back"


class ImportPhase(str, enum.Enum):
    WEIGHT_TABLE_IMPORTED = "weight_table_imported"
    OLD_FORMULA_REVIEWED = "old_formula_reviewed"
    COUNTEREXAMPLE_UPDATED = "counterexample_updated"


class BoundaryJudgment(str, enum.Enum):
    BELOW_THRESHOLD = "below_threshold"
    ABOVE_THRESHOLD = "above_threshold"
    EQUAL_THRESHOLD = "equal_threshold"


class ErrorType(str, enum.Enum):
    WRONG_CALIBER = "wrong_caliber"
    SUPPLEMENTARY_REWORK = "supplementary_rework"
    OTHER = "other"


class ScoringWeightRow(Base):
    __tablename__ = "scoring_weight_rows"

    id = Column(Integer, primary_key=True, index=True)
    import_batch_id = Column(String, nullable=False, index=True)
    original_row_number = Column(Integer, nullable=False)
    indicator_name = Column(String, nullable=False)
    threshold = Column(Float, nullable=False)
    weight = Column(Float, nullable=False)
    original_value = Column(Float, nullable=True)
    interpolated_value = Column(Float, nullable=True)
    boundary_judgment = Column(Enum(BoundaryJudgment), nullable=True)
    processing_status = Column(Enum(ProcessingStatus), default=ProcessingStatus.PENDING)
    error_type = Column(Enum(ErrorType), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    audit_trails = relationship("AuditTrail", back_populates="row", cascade="all, delete-orphan")
    repair_records = relationship("RepairRecord", back_populates="row", cascade="all, delete-orphan")


class AuditTrail(Base):
    __tablename__ = "audit_trails"

    id = Column(Integer, primary_key=True, index=True)
    row_id = Column(Integer, ForeignKey("scoring_weight_rows.id"), nullable=False)
    original_row_number = Column(Integer, nullable=False)
    field_name = Column(String, nullable=False)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    change_reason = Column(Text, nullable=True)
    changed_by = Column(String, nullable=False, default="system")
    changed_at = Column(DateTime, default=datetime.utcnow)

    row = relationship("ScoringWeightRow", back_populates="audit_trails")


class RepairRecord(Base):
    __tablename__ = "repair_records"

    id = Column(Integer, primary_key=True, index=True)
    row_id = Column(Integer, ForeignKey("scoring_weight_rows.id"), nullable=False)
    import_batch_id = Column(String, nullable=False, index=True)
    phase = Column(Enum(ImportPhase), nullable=False)
    boundary_judgment = Column(Enum(BoundaryJudgment), nullable=True)
    interpolated_curve_data = Column(JSON, nullable=True)
    old_formula_screenshot_ref = Column(String, nullable=True)
    counterexample_note = Column(Text, nullable=True)
    is_boundary_equal_threshold = Column(Integer, default=0)
    instructor_reviewed = Column(Integer, default=0)
    rollback_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    row = relationship("ScoringWeightRow", back_populates="repair_records")


class WorkflowState(Base):
    __tablename__ = "workflow_states"

    id = Column(Integer, primary_key=True, index=True)
    import_batch_id = Column(String, unique=True, nullable=False, index=True)
    current_phase = Column(Enum(ImportPhase), default=ImportPhase.WEIGHT_TABLE_IMPORTED)
    total_rows = Column(Integer, default=0)
    boundary_equal_threshold_count = Column(Integer, default=0)
    wrong_caliber_count = Column(Integer, default=0)
    supplementary_rework_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
