from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel
from interpolation_gauge.models.schemas import ProcessingStatus, ImportPhase, BoundaryJudgment, ErrorType


class WeightRowImportItem(BaseModel):
    original_row_number: int
    indicator_name: str
    threshold: float
    weight: float
    original_value: Optional[float] = None

class WeightTableImportRequest(BaseModel):
    rows: List[WeightRowImportItem]

class WeightRowResponse(BaseModel):
    id: int
    import_batch_id: str
    original_row_number: int
    indicator_name: str
    threshold: float
    weight: float
    original_value: Optional[float]
    interpolated_value: Optional[float]
    boundary_judgment: Optional[BoundaryJudgment]
    processing_status: ProcessingStatus
    error_type: Optional[ErrorType]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class AuditTrailResponse(BaseModel):
    id: int
    row_id: int
    original_row_number: int
    field_name: str
    old_value: Optional[str]
    new_value: Optional[str]
    change_reason: Optional[str]
    changed_by: str
    changed_at: datetime

    class Config:
        from_attributes = True

class RepairRecordResponse(BaseModel):
    id: int
    row_id: int
    import_batch_id: str
    phase: ImportPhase
    boundary_judgment: Optional[BoundaryJudgment]
    interpolated_curve_data: Optional[dict]
    old_formula_screenshot_ref: Optional[str]
    counterexample_note: Optional[str]
    is_boundary_equal_threshold: bool
    instructor_reviewed: bool
    rollback_reason: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

    @classmethod
    def from_orm_with_bool(cls, obj):
        data = {c.name: getattr(obj, c.name) for c in obj.__table__.columns}
        data["is_boundary_equal_threshold"] = bool(data["is_boundary_equal_threshold"])
        data["instructor_reviewed"] = bool(data["instructor_reviewed"])
        return cls(**data)

class WorkflowStateResponse(BaseModel):
    id: int
    import_batch_id: str
    current_phase: ImportPhase
    total_rows: int
    boundary_equal_threshold_count: int
    wrong_caliber_count: int
    supplementary_rework_count: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ManualOverrideRequest(BaseModel):
    row_id: int
    field_name: str
    new_value: str
    change_reason: str
    changed_by: str = "analyst_qi"

class PhaseAdvanceRequest(BaseModel):
    import_batch_id: str
    target_phase: ImportPhase

class BoundaryReviewRequest(BaseModel):
    row_id: int
    confirmed_normal: bool
    reviewer: str = "instructor"
    reason: Optional[str] = None

class RollbackRequest(BaseModel):
    row_id: int
    rollback_reason: str

class QuickFixRequest(BaseModel):
    row_id: int
    error_type: ErrorType
    fix_value: Optional[float] = None
    fix_reason: str
    changed_by: str = "analyst_qi"

class CounterexampleUpdateRequest(BaseModel):
    import_batch_id: str
    row_id: int
    counterexample_note: str

class OldFormulaReviewRequest(BaseModel):
    import_batch_id: str
    row_id: int
    screenshot_ref: str
    note: Optional[str] = None

class ExportDetailResponse(BaseModel):
    row: WeightRowResponse
    audit_trails: List[AuditTrailResponse]
    repair_records: List[RepairRecordResponse]
