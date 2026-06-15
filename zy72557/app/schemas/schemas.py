from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class EvaluationSliceBase(BaseModel):
    original_row_number: int = Field(..., description="评测切片原始行号")
    main_process_data: Dict[str, Any] = Field(..., description="主流程数据")
    import_batch_id: Optional[str] = None
    remarks: Optional[str] = None


class EvaluationSliceCreate(EvaluationSliceBase):
    pass


class EvaluationSliceResponse(EvaluationSliceBase):
    id: int
    current_status: str
    import_time: datetime
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class FeatureSnapshotBase(BaseModel):
    snapshot_number: str = Field(..., description="特征快照编号")
    on_site_statement: Optional[str] = None
    feature_data: Optional[Dict[str, Any]] = None
    supplemented_by: Optional[str] = None


class FeatureSnapshotCreate(FeatureSnapshotBase):
    evaluation_slice_id: int


class FeatureSnapshotResponse(FeatureSnapshotBase):
    id: int
    evaluation_slice_id: int
    is_resupplemented: bool
    supplement_time: datetime

    class Config:
        from_attributes = True


class CheckResultResponse(BaseModel):
    id: int
    evaluation_slice_id: int
    feature_snapshot_id: Optional[int]
    check_type: str
    check_status: str
    severity: str
    result_detail: Optional[Dict[str, Any]]
    evidence_chain: Optional[Dict[str, Any]]
    threshold_old_value: Optional[float]
    threshold_new_value: Optional[float]
    report_threshold_value: Optional[float]
    needs_data_scientist_review: bool
    reviewer: Optional[str]
    review_time: Optional[datetime]
    review_comment: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class WorkflowStepResponse(BaseModel):
    id: int
    evaluation_slice_id: int
    step_number: int
    step_name: str
    step_status: str
    operator: Optional[str]
    operation_time: Optional[datetime]
    step_data: Optional[Dict[str, Any]]

    class Config:
        from_attributes = True


class ManualChangeCreate(BaseModel):
    evaluation_slice_id: int
    check_result_id: Optional[int] = None
    field_name: str
    old_value: Optional[str] = None
    new_value: str
    changed_by: Optional[str] = None
    change_reason: Optional[str] = None


class ManualChangeResponse(BaseModel):
    id: int
    evaluation_slice_id: int
    check_result_id: Optional[int]
    field_name: str
    old_value: Optional[str]
    new_value: str
    changed_by: Optional[str]
    change_time: datetime
    change_reason: Optional[str]

    class Config:
        from_attributes = True


class StatusHistoryResponse(BaseModel):
    id: int
    evaluation_slice_id: int
    check_result_id: Optional[int]
    old_status: Optional[str]
    new_status: str
    changed_by: Optional[str]
    change_reason: Optional[str]
    change_time: datetime
    step_context: Optional[Dict[str, Any]]

    class Config:
        from_attributes = True


class ThresholdUpdate(BaseModel):
    threshold_name: str
    new_value: float
    changed_by: Optional[str] = None
    apply_to_report: bool = False


class ExportRequest(BaseModel):
    export_type: str = Field(default="detail", description="导出类型：detail/summary")
    check_status_filter: Optional[List[str]] = None
    check_type_filter: Optional[List[str]] = None
    exported_by: Optional[str] = None


class CheckResultSummary(BaseModel):
    total_count: int
    normal_count: int
    abnormal_count: int
    pending_review_count: int
    by_type: Dict[str, int]
    by_severity: Dict[str, int]
