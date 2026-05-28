from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class LcClauseBase(BaseModel):
    clause_number: Optional[str] = None
    clause_type: Optional[str] = None
    content: str
    parsed_fields: Optional[Dict[str, Any]] = None
    remarks: Optional[str] = None


class LcClauseCreate(LcClauseBase):
    pass


class LcClause(LcClauseBase):
    id: int
    lc_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DocumentBase(BaseModel):
    document_type: str
    document_number: str
    content: Optional[Dict[str, Any]] = None
    raw_text: Optional[str] = None
    remarks: Optional[str] = None
    submitted_by: Optional[str] = None


class DocumentCreate(DocumentBase):
    lc_id: int


class DocumentUpdate(BaseModel):
    content: Optional[Dict[str, Any]] = None
    raw_text: Optional[str] = None
    remarks: Optional[str] = None
    submitted_by: Optional[str] = None


class Document(DocumentBase):
    id: int
    lc_id: int
    version: int
    is_active: bool
    submitted_at: datetime
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DiscrepancyBase(BaseModel):
    discrepancy_type: str
    severity: Optional[str] = "MEDIUM"
    status: Optional[str] = "OPEN"
    description: str
    reason: Optional[str] = None
    impact_scope: Optional[str] = None
    next_action: Optional[str] = None
    clause_ref: Optional[str] = None
    document_ref: Optional[str] = None
    correction_note: Optional[str] = None
    corrected_by: Optional[str] = None


class DiscrepancyCreate(DiscrepancyBase):
    lc_id: int
    document_id: Optional[int] = None
    clause_id: Optional[int] = None


class DiscrepancyUpdate(BaseModel):
    status: Optional[str] = None
    severity: Optional[str] = None
    reason: Optional[str] = None
    impact_scope: Optional[str] = None
    next_action: Optional[str] = None
    correction_note: Optional[str] = None
    corrected_by: Optional[str] = None


class Discrepancy(DiscrepancyBase):
    id: int
    lc_id: int
    document_id: Optional[int] = None
    clause_id: Optional[int] = None
    corrected_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LetterOfCreditBase(BaseModel):
    lc_number: str
    issuing_bank: Optional[str] = None
    applicant: Optional[str] = None
    beneficiary: Optional[str] = None
    currency: Optional[str] = "USD"
    amount: Optional[float] = None
    latest_shipment_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    clauses_text: Optional[str] = None
    status: Optional[str] = "DRAFT"
    remarks: Optional[str] = None


class LetterOfCreditCreate(LetterOfCreditBase):
    clauses: Optional[List[LcClauseCreate]] = None


class LetterOfCreditUpdate(BaseModel):
    issuing_bank: Optional[str] = None
    applicant: Optional[str] = None
    beneficiary: Optional[str] = None
    currency: Optional[str] = None
    amount: Optional[float] = None
    latest_shipment_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    clauses_text: Optional[str] = None
    status: Optional[str] = None
    remarks: Optional[str] = None


class LetterOfCredit(LetterOfCreditBase):
    id: int
    created_at: datetime
    updated_at: datetime
    documents: List[Document] = []
    clauses: List[LcClause] = []
    discrepancies: List[Discrepancy] = []

    model_config = ConfigDict(from_attributes=True)


class LetterOfCreditSummary(BaseModel):
    id: int
    lc_number: str
    issuing_bank: Optional[str] = None
    applicant: Optional[str] = None
    amount: Optional[float] = None
    currency: Optional[str] = None
    status: str
    latest_shipment_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    discrepancy_count: int = 0
    open_discrepancy_count: int = 0
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class VersionRecord(BaseModel):
    id: int
    related_type: str
    related_id: int
    version: int
    action: Optional[str] = None
    old_content: Optional[Dict[str, Any]] = None
    new_content: Optional[Dict[str, Any]] = None
    change_reason: Optional[str] = None
    operator: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AttachmentBase(BaseModel):
    related_type: str
    related_id: int
    file_name: str
    file_type: Optional[str] = None
    description: Optional[str] = None
    uploaded_by: Optional[str] = None


class AttachmentCreate(AttachmentBase):
    file_path: str


class Attachment(AttachmentBase):
    id: int
    file_path: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ClauseParseRequest(BaseModel):
    clauses_text: str


class ClauseParseResult(BaseModel):
    clause_number: str
    clause_type: str
    content: str
    parsed_fields: Dict[str, Any]


class DocumentCompareRequest(BaseModel):
    lc_id: int
    document_id: Optional[int] = None
    document_type: Optional[str] = None


class CompareResultItem(BaseModel):
    field_name: str
    clause_value: Optional[str] = None
    document_value: Optional[str] = None
    match: bool
    discrepancy_type: Optional[str] = None
    severity: Optional[str] = None
    description: Optional[str] = None
    reason: Optional[str] = None
    impact_scope: Optional[str] = None
    next_action: Optional[str] = None


class DocumentCompareResult(BaseModel):
    lc_id: int
    document_id: int
    document_type: str
    document_number: str
    total_checks: int
    matched_count: int
    discrepancy_count: int
    results: List[CompareResultItem]
    discrepancies_created: List[int] = []


class StatusTransitionRequest(BaseModel):
    new_status: str
    remarks: Optional[str] = None
    operator: Optional[str] = None


class ApiResponse(BaseModel):
    success: bool
    message: str
    data: Optional[Any] = None
    errors: Optional[List[str]] = None
