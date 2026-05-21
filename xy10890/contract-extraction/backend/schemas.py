from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from models import ContractStatus, RiskLevel


class ClauseTypeBase(BaseModel):
    name: str
    description: Optional[str] = None


class ClauseTypeCreate(ClauseTypeBase):
    pass


class ClauseTypeResponse(ClauseTypeBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ClauseBase(BaseModel):
    clause_title: Optional[str] = None
    original_text: str
    extracted_text: Optional[str] = None
    revised_text: Optional[str] = None
    risk_level: RiskLevel = RiskLevel.LOW
    risk_reason: Optional[str] = None
    confidence_score: Optional[float] = None


class ClauseCreate(ClauseBase):
    clause_type_id: Optional[int] = None


class ClauseUpdate(BaseModel):
    clause_title: Optional[str] = None
    revised_text: Optional[str] = None
    risk_level: Optional[RiskLevel] = None
    risk_reason: Optional[str] = None
    is_approved: Optional[bool] = None


class ClauseRevisionResponse(BaseModel):
    id: int
    version_number: int
    text_before: Optional[str]
    text_after: Optional[str]
    revised_by: Optional[str]
    revision_note: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ClauseResponse(ClauseBase):
    id: int
    contract_id: int
    clause_type_id: Optional[int]
    clause_type: Optional[ClauseTypeResponse]
    is_approved: bool
    approved_by: Optional[str]
    approved_at: Optional[datetime]
    created_at: datetime
    updated_at: Optional[datetime]
    revisions: List[ClauseRevisionResponse] = []

    class Config:
        from_attributes = True


class ContractBase(BaseModel):
    contract_name: Optional[str] = None
    party_a: Optional[str] = None
    party_b: Optional[str] = None
    effective_date: Optional[datetime] = None
    expiration_date: Optional[datetime] = None


class ContractCreate(ContractBase):
    filename: str
    file_path: str
    file_size: Optional[int] = None


class ContractUpdate(BaseModel):
    contract_name: Optional[str] = None
    party_a: Optional[str] = None
    party_b: Optional[str] = None
    effective_date: Optional[datetime] = None
    expiration_date: Optional[datetime] = None
    status: Optional[ContractStatus] = None
    overall_risk: Optional[RiskLevel] = None


class ContractVersionResponse(BaseModel):
    id: int
    version_number: int
    status: ContractStatus
    overall_risk: RiskLevel
    created_by: Optional[str]
    change_log: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class TimelineEventResponse(BaseModel):
    id: int
    event_type: str
    event_data: Optional[str]
    created_by: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ContractResponse(ContractBase):
    id: int
    filename: str
    file_size: Optional[int]
    status: ContractStatus
    overall_risk: RiskLevel
    extracted_at: Optional[datetime]
    retry_count: int
    error_message: Optional[str]
    created_by: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
    clauses: List[ClauseResponse] = []
    versions: List[ContractVersionResponse] = []
    timeline: List[TimelineEventResponse] = []

    class Config:
        from_attributes = True


class ContractListResponse(BaseModel):
    id: int
    filename: str
    contract_name: Optional[str]
    party_a: Optional[str]
    party_b: Optional[str]
    status: ContractStatus
    overall_risk: RiskLevel
    clause_count: int
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class PaginatedResponse(BaseModel):
    items: List[ContractListResponse]
    total: int
    page: int
    page_size: int


class ExtractRequest(BaseModel):
    contract_ids: List[int]


class StatusUpdateRequest(BaseModel):
    status: ContractStatus
    note: Optional[str] = None


class RiskAnnotationRequest(BaseModel):
    risk_level: RiskLevel
    risk_reason: Optional[str] = None


class RevisionRequest(BaseModel):
    revised_text: str
    revision_note: Optional[str] = None


class VersionCompareRequest(BaseModel):
    contract_id: int
    version_a: int
    version_b: int


class VersionChangeItem(BaseModel):
    clause_title: str
    old_text: Optional[str] = None
    new_text: Optional[str] = None
    change_type: str


class VersionCompareResponse(BaseModel):
    contract_id: int
    version_a: int
    version_b: int
    added_clauses: List[VersionChangeItem] = []
    removed_clauses: List[VersionChangeItem] = []
    modified_clauses: List[VersionChangeItem] = []
    contract_changes: Dict[str, Any] = {}


class ExportRequest(BaseModel):
    contract_ids: List[int]
    format: str = Field(default="excel", description="export format: excel, pdf, json")
    include_clauses: bool = True
    include_revisions: bool = False


class BulkUploadResponse(BaseModel):
    success_count: int
    failed_count: int
    failed_files: List[str]
    contract_ids: List[int]


class ErrorResponse(BaseModel):
    detail: str
    error_code: str
    timestamp: datetime
