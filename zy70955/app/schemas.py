from datetime import datetime
from typing import Optional, List, Any, Dict

from pydantic import BaseModel, Field


class BatchCreate(BaseModel):
    batch_no: str = Field(..., min_length=1, max_length=64, description="批次编号")
    submitter: str = Field(..., min_length=1, max_length=128, description="提交人")
    department: str = Field(default="展陈部", max_length=128)
    source_type: str = Field(default="manual", max_length=32)


class BatchResponse(BaseModel):
    id: int
    batch_no: str
    submitter: str
    department: str
    source_type: str
    status: str
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class MaterialItem(BaseModel):
    line_no: int
    artifact_no: Optional[str] = None
    artifact_name: Optional[str] = None
    borrower: Optional[str] = None
    lender: Optional[str] = None
    loan_start: Optional[str] = None
    loan_end: Optional[str] = None
    insurance_value: Optional[str] = None
    insurance_type: Optional[str] = None
    condition: Optional[str] = None
    location: Optional[str] = None
    remark: Optional[str] = None


class MaterialsUpload(BaseModel):
    items: List[MaterialItem]


class MaterialResponse(BaseModel):
    id: int
    batch_id: int
    line_no: int
    artifact_no: Optional[str]
    artifact_name: Optional[str]
    borrower: Optional[str]
    lender: Optional[str]
    loan_start: Optional[str]
    loan_end: Optional[str]
    insurance_value: Optional[str]
    insurance_type: Optional[str]
    condition: Optional[str]
    location: Optional[str]
    remark: Optional[str]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class DetailResponse(BaseModel):
    id: int
    raw_material_id: int
    batch_id: int
    category: str
    reason_code: str
    reason_detail: Optional[str]
    next_action: Optional[str]
    review_status: str
    reviewed_by: Optional[str]
    reviewed_at: Optional[datetime]
    report_snapshot: Optional[Dict[str, Any]]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class TrajectoryItem(BaseModel):
    id: int
    detail_id: int
    stage: str
    action: str
    operator: str
    old_value: Optional[Dict[str, Any]]
    new_value: Optional[Dict[str, Any]]
    comment: Optional[str]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class DetailWithTrajectories(BaseModel):
    detail: DetailResponse
    material: MaterialResponse
    trajectories: List[TrajectoryItem]
    audit_logs: List[Dict[str, Any]]


class ReviewRequest(BaseModel):
    operator: str = Field(..., min_length=1, max_length=128, description="复核人")
    review_result: str = Field(..., pattern="^(approve|reject|change)$", description="复核结果")
    change_target: Optional[str] = Field(default=None, description="当 review_result=change 时指定修改字段名")
    change_value: Optional[Any] = Field(default=None, description="当 review_result=change 时指定新值")
    reason: str = Field(..., min_length=1, description="复核意见/变更原因")


class FieldTraceItem(BaseModel):
    field_name: str
    raw_value: Optional[str]
    processed_value: Optional[Any]
    report_value: Optional[Any]
    transforms: List[Dict[str, Any]] = []
