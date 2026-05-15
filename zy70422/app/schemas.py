from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from .models import InspectionStatus, RectificationStatus, PhotoType


class StoreBase(BaseModel):
    name: str
    code: str
    region: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None


class StoreCreate(StoreBase):
    pass


class StoreResponse(StoreBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class InspectionItemBase(BaseModel):
    name: str
    code: str
    category: Optional[str] = None
    description: Optional[str] = None
    base_score: float = 10.0


class InspectionItemCreate(InspectionItemBase):
    pass


class InspectionItemResponse(InspectionItemBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class InspectionBase(BaseModel):
    store_id: int
    inspector: Optional[str] = None
    remark: Optional[str] = None


class InspectionCreate(InspectionBase):
    pass


class InspectionResponse(BaseModel):
    id: int
    store_id: int
    store_name: Optional[str] = None
    inspector: Optional[str] = None
    inspection_date: datetime
    status: InspectionStatus
    remark: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class InspectionRecordBase(BaseModel):
    item_id: int
    is_pass: bool = True
    deduction_reason: Optional[str] = None
    remark: Optional[str] = None


class InspectionRecordCreate(InspectionRecordBase):
    pass


class InspectionRecordResponse(BaseModel):
    id: int
    inspection_id: int
    item_id: int
    item_name: Optional[str] = None
    item_category: Optional[str] = None
    is_pass: bool
    score: float
    deduction: float
    deduction_reason: Optional[str] = None
    remark: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RectificationBase(BaseModel):
    assignee: str
    deadline: datetime


class RectificationCreate(BaseModel):
    record_id: int
    assignee: str
    deadline: datetime


class RectificationSubmit(BaseModel):
    rectification_description: str


class RectificationRecheck(BaseModel):
    rechecker: str
    recheck_result: str
    recheck_remark: Optional[str] = None


class RectificationResponse(BaseModel):
    id: int
    record_id: int
    assignee: str
    status: RectificationStatus
    deadline: datetime
    rectification_description: Optional[str] = None
    rectification_at: Optional[datetime] = None
    rechecker: Optional[str] = None
    recheck_result: Optional[str] = None
    recheck_remark: Optional[str] = None
    recheck_at: Optional[datetime] = None
    final_score: Optional[float] = None
    final_deduction: float = 0.0
    retry_count: int
    parent_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PhotoEvidenceBase(BaseModel):
    photo_type: PhotoType
    file_path: str
    file_name: Optional[str] = None
    description: Optional[str] = None
    uploaded_by: Optional[str] = None


class PhotoEvidenceCreate(PhotoEvidenceBase):
    record_id: Optional[int] = None
    rectification_id: Optional[int] = None


class PhotoEvidenceResponse(BaseModel):
    id: int
    record_id: Optional[int] = None
    rectification_id: Optional[int] = None
    photo_type: PhotoType
    file_path: str
    file_name: Optional[str] = None
    description: Optional[str] = None
    uploaded_by: Optional[str] = None
    upload_time: datetime

    class Config:
        from_attributes = True


class DeductionRuleBase(BaseModel):
    name: str
    item_category: Optional[str] = None
    level: int
    base_deduction: float = 0.0
    overdue_multiplier: float = 1.0
    retry_penalty: float = 0.0
    description: Optional[str] = None


class DeductionRuleCreate(DeductionRuleBase):
    pass


class DeductionRuleResponse(DeductionRuleBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class EventResponse(BaseModel):
    id: int
    rectification_id: int
    event_type: str
    from_status: Optional[RectificationStatus] = None
    to_status: RectificationStatus
    actor: Optional[str] = None
    description: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class RegionReport(BaseModel):
    region: str
    total_stores: int
    total_inspections: int
    total_issues: int
    total_rectifications: int
    passed_rectifications: int
    overdue_rectifications: int
    total_deduction: float
    avg_score: float


class RollbackCandidateCreate(BaseModel):
    candidate_type: str
    source_id: Optional[str] = None
    source_table: Optional[str] = None
    title: str
    description: Optional[str] = None
    summary: Optional[str] = None
    file_path: Optional[str] = None
    file_hash: Optional[str] = None
    file_size: Optional[int] = None
    is_urgent: bool = False
    created_by: Optional[str] = None


class RollbackCandidateResponse(BaseModel):
    id: int
    candidate_type: str
    source_id: Optional[str] = None
    source_table: Optional[str] = None
    title: str
    description: Optional[str] = None
    summary: Optional[str] = None
    file_path: Optional[str] = None
    file_hash: Optional[str] = None
    file_size: Optional[int] = None
    is_urgent: bool
    status: str
    approver: Optional[str] = None
    approval_remark: Optional[str] = None
    approved_at: Optional[datetime] = None
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RollbackApproval(BaseModel):
    approver: str
    approval_remark: Optional[str] = None
    is_approved: bool = True


class RollbackExecuteRequest(BaseModel):
    executor: str


class RollbackExecutionResponse(BaseModel):
    id: int
    candidate_id: int
    executor: Optional[str] = None
    started_at: datetime
    completed_at: Optional[datetime] = None
    status: str
    before_state: Optional[str] = None
    after_state: Optional[str] = None
    error_message: Optional[str] = None
    execution_time_ms: Optional[int] = None
    success_count: int
    total_count: int
    failed_records: Optional[str] = None
    next_suggestion: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class NightlyInspectionCreate(BaseModel):
    is_grayscale: bool = True
    region: Optional[str] = None
    target_type: Optional[str] = None
    total_checks: int = 0
    passed_checks: int = 0
    failed_checks: int = 0
    materials: Optional[str] = None
    result_summary: Optional[str] = None
    executed_by: Optional[str] = None


class NightlyInspectionResponse(BaseModel):
    id: int
    inspection_date: datetime
    is_grayscale: bool
    region: Optional[str] = None
    target_type: Optional[str] = None
    total_checks: int
    passed_checks: int
    failed_checks: int
    materials: Optional[str] = None
    result_summary: Optional[str] = None
    executed_by: Optional[str] = None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class FinancialCloseCreate(BaseModel):
    close_period: str
    total_amount: float = 0.0
    record_count: int = 0
    summary: Optional[str] = None
    file_path: Optional[str] = None
    created_by: Optional[str] = None


class FinancialCloseResponse(BaseModel):
    id: int
    close_period: str
    total_amount: float
    record_count: int
    summary: Optional[str] = None
    file_path: Optional[str] = None
    status: str
    approver: Optional[str] = None
    approval_remark: Optional[str] = None
    approved_at: Optional[datetime] = None
    manually_confirmed: bool
    confirmed_by: Optional[str] = None
    confirmed_at: Optional[datetime] = None
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class FinancialConfirmRequest(BaseModel):
    confirmed_by: str
    confirm_remark: Optional[str] = None


class RollbackComparisonResponse(BaseModel):
    candidate_id: int
    title: str
    before_state: Optional[str] = None
    after_state: Optional[str] = None
    execution_time_ms: Optional[int] = None
    status: str
    success_count: int
    total_count: int
    next_suggestion: Optional[str] = None


class RollbackCandidateFilter(BaseModel):
    candidate_type: Optional[str] = None
    status: Optional[str] = None
    summary_keyword: Optional[str] = None
    is_urgent: Optional[bool] = None
