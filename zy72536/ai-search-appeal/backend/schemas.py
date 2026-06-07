from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class SampleBase(BaseModel):
    sample_no: str
    query: str
    doc_title: str
    doc_url: str
    original_rank: int
    expected_rank: Optional[int] = None
    confidence: float
    is_low_confidence: bool = False
    is_hidden_by_avg: bool = False
    current_rank: Optional[int] = None
    status: str = "待复核"
    manual_note: Optional[str] = None


class SampleCreate(SampleBase):
    pass


class SampleUpdate(BaseModel):
    expected_rank: Optional[int] = None
    status: Optional[str] = None
    manual_note: Optional[str] = None
    is_hidden_by_avg: Optional[bool] = None


class Sample(SampleBase):
    id: int
    ticket_id: int
    created_at: datetime
    updated_at: datetime
    versions: List["SampleVersion"] = []

    class Config:
        from_attributes = True


class SampleVersionBase(BaseModel):
    rank: int
    score: float
    is_manual_modified: bool = False


class SampleVersionCreate(SampleVersionBase):
    model_version_id: int


class SampleVersion(SampleVersionBase):
    id: int
    sample_id: int
    model_version_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class AppealTicketBase(BaseModel):
    ticket_no: str
    source: str = "线上反馈工单"
    original_row_no: int
    raw_content: Dict[str, Any]
    status: str = "待处理"
    handler: Optional[str] = None
    desensitization_note: Optional[str] = None


class AppealTicketCreate(AppealTicketBase):
    samples: List[SampleCreate]


class AppealTicketUpdate(BaseModel):
    status: Optional[str] = None
    handler: Optional[str] = None
    desensitization_note: Optional[str] = None


class AppealTicket(AppealTicketBase):
    id: int
    created_at: datetime
    updated_at: datetime
    samples: List[Sample] = []

    class Config:
        from_attributes = True


class ModelVersionBase(BaseModel):
    version_name: str
    description: Optional[str] = None


class ModelVersionCreate(ModelVersionBase):
    pass


class ModelVersion(ModelVersionBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class AuditLogBase(BaseModel):
    action: str
    operator: str
    before_value: Optional[Dict[str, Any]] = None
    after_value: Optional[Dict[str, Any]] = None
    note: Optional[str] = None


class AuditLogCreate(AuditLogBase):
    ticket_id: int
    sample_id: Optional[int] = None


class AuditLog(AuditLogBase):
    id: int
    ticket_id: int
    sample_id: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


class SelfCheckResultBase(BaseModel):
    ticket_id: int
    check_type: str
    passed: bool
    details: Optional[Dict[str, Any]] = None


class SelfCheckResult(SelfCheckResultBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class ImportResult(BaseModel):
    success: bool
    ticket_id: int
    ticket_no: str
    samples_count: int
    warnings: List[str] = []


class RecalculateResult(BaseModel):
    success: bool
    ticket_id: int
    recalculated_count: int
    hidden_by_avg_count: int


class VersionCompareItem(BaseModel):
    sample_id: int
    sample_no: str
    query: str
    doc_title: str
    from_source: str
    status: str
    v1_rank: Optional[int] = None
    v2_rank: Optional[int] = None
    rank_change: Optional[int] = None
    is_low_confidence: bool
    is_hidden_by_avg: bool


class VersionCompareResult(BaseModel):
    version1: str
    version2: str
    items: List[VersionCompareItem]
    total_count: int
    pending_review_count: int
    from_ticket_count: int


Sample.model_rebuild()
