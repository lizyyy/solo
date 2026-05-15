from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from models import MaterialStatus, EvaluationResult, OperationType


class MaterialBase(BaseModel):
    batch_id: str
    file_name: str
    file_summary: str
    content: str


class MaterialCreate(MaterialBase):
    pass


class MaterialResponse(BaseModel):
    id: int
    batch_id: str
    file_hash: str
    file_name: str
    file_summary: str
    status: str
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class MaterialDetailResponse(MaterialResponse):
    content: str


class EvaluationBase(BaseModel):
    material_id: int


class EvaluationCreate(EvaluationBase):
    pass


class EvaluationResponse(BaseModel):
    id: int
    material_id: int
    result: str
    confidence: float
    reasoning: Optional[str]
    failure_path: Optional[str]
    failure_details: Optional[str]
    success_count: int
    total_count: int
    is_manual_confirmed: bool
    confirmed_by: Optional[str]
    confirmed_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class CorrectionBase(BaseModel):
    material_id: int
    evaluation_id: Optional[int]
    operator: str
    corrected_result: str
    remark: str


class CorrectionCreate(CorrectionBase):
    pass


class CorrectionResponse(BaseModel):
    id: int
    material_id: int
    evaluation_id: Optional[int]
    operator: str
    original_result: Optional[str]
    corrected_result: str
    remark: str
    created_at: datetime

    class Config:
        from_attributes = True


class BatchSubmitRequest(BaseModel):
    batch_id: str
    materials: List[MaterialCreate]


class BatchSubmitResponse(BaseModel):
    batch_id: str
    total_count: int
    new_count: int
    reused_count: int
    conflict_count: int
    materials: List[MaterialResponse]


class ConfirmEvaluationRequest(BaseModel):
    operator: str
    confirmed: bool


class CandidateListCreate(BaseModel):
    operation_type: str
    name: str
    target_ids: List[int]


class CandidateListResponse(BaseModel):
    id: int
    operation_type: str
    name: str
    target_ids: List[int]
    is_executed: bool
    executed_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class BatchOperationPreview(BaseModel):
    operation_type: str
    candidate_list_id: int
    affected_count: int
    affected_materials: List[MaterialResponse]


class QueryFilter(BaseModel):
    file_summary: Optional[str] = None
    status: Optional[str] = None
    batch_id: Optional[str] = None
    only_needs_confirmation: bool = False
