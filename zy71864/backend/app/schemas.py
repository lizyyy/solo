from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class QuestionBankBase(BaseModel):
    question_no: str
    content: str
    standard_answer: str
    recurrence_formula: Optional[str] = None
    created_by: Optional[str] = None


class QuestionBankCreate(QuestionBankBase):
    pass


class QuestionBankUpdate(BaseModel):
    content: Optional[str] = None
    standard_answer: Optional[str] = None
    recurrence_formula: Optional[str] = None
    created_by: Optional[str] = None


class QuestionBankResponse(QuestionBankBase):
    id: int
    version: int
    created_at: datetime
    is_active: bool
    parent_id: Optional[int] = None

    class Config:
        from_attributes = True


class EquivalentAnswerBase(BaseModel):
    question_bank_id: int
    answer_expression: str
    description: Optional[str] = None


class EquivalentAnswerCreate(EquivalentAnswerBase):
    pass


class EquivalentAnswerResponse(EquivalentAnswerBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class EvaluationRecordBase(BaseModel):
    student_id: str
    student_name: str
    question_no: str
    student_answer: str
    score: Optional[float] = None
    batch_id: Optional[str] = None
    remark: Optional[str] = None


class EvaluationRecordCreate(EvaluationRecordBase):
    pass


class EvaluationRecordResponse(EvaluationRecordBase):
    id: int
    evaluation_time: datetime

    class Config:
        from_attributes = True


class FilterConditionBase(BaseModel):
    user_id: str
    condition_name: Optional[str] = None
    condition_json: Dict[str, Any]
    is_current: bool = False


class FilterConditionCreate(FilterConditionBase):
    pass


class FilterConditionResponse(FilterConditionBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class DiagnosisBatchBase(BaseModel):
    batch_name: str
    filter_condition_id: Optional[int] = None


class DiagnosisBatchCreate(DiagnosisBatchBase):
    evaluation_record_ids: List[int]
    material_hash: str


class DiagnosisBatchResponse(BaseModel):
    id: int
    batch_hash: str
    batch_name: str
    material_count: int
    status: str
    error_message: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    filter_condition_id: Optional[int] = None
    is_reused: bool = False

    class Config:
        from_attributes = True


class DiagnosisResultBase(BaseModel):
    batch_id: int
    question_bank_id: Optional[int] = None
    evaluation_record_id: int
    diagnosis_type: str
    is_correct: bool
    is_equivalent: bool = False
    matched_equivalent_id: Optional[int] = None
    error_type: Optional[str] = None
    human_readable_error: Optional[str] = None
    suggestion: Optional[str] = None
    next_action: Optional[str] = None
    contact_person: Optional[str] = None


class DiagnosisResultCreate(DiagnosisResultBase):
    pass


class DiagnosisResultResponse(DiagnosisResultBase):
    id: int
    created_at: datetime
    question: Optional[QuestionBankResponse] = None
    evaluation_record: Optional[EvaluationRecordResponse] = None
    matched_equivalent: Optional[EquivalentAnswerResponse] = None

    class Config:
        from_attributes = True


class DiagnosisRequest(BaseModel):
    batch_name: str = Field(..., description="诊断批次名称")
    evaluation_record_ids: List[int] = Field(..., description="要诊断的讲评记录ID列表")
    filter_condition_id: Optional[int] = Field(None, description="筛选条件ID")


class BatchDiagnosisResponse(BaseModel):
    batch: DiagnosisBatchResponse
    results: List[DiagnosisResultResponse]
    summary: Dict[str, Any]


class ErrorResponse(BaseModel):
    error_code: str
    message: str
    suggestion: Optional[str] = None
    contact_person: Optional[str] = None
    details: Optional[Dict[str, Any]] = None


class EmptySetInfo(BaseModel):
    source: str
    source_type: str
    count: int
    description: str
    next_action: str
    contact_person: str


class ExportRequest(BaseModel):
    batch_id: int
    filter_condition_id: Optional[int] = None
    format: str = "xlsx"


class PaginatedResponse(BaseModel):
    items: List[Any]
    total: int
    page: int
    page_size: int
