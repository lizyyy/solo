from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class InvoiceBase(BaseModel):
    original_filename: str
    file_path: str
    invoice_code: Optional[str] = None
    invoice_number: Optional[str] = None
    reimbursement_id: Optional[str] = None
    amount: Optional[float] = None

class InvoiceCreate(InvoiceBase):
    pass

class InvoiceUpdate(BaseModel):
    invoice_code: Optional[str] = None
    invoice_number: Optional[str] = None
    reimbursement_id: Optional[str] = None
    amount: Optional[float] = None
    status: Optional[str] = None
    match_status: Optional[str] = None

class Invoice(InvoiceBase):
    id: int
    directory_id: int
    is_duplicate: bool
    duplicate_with: Optional[int] = None
    status: str
    match_status: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class ImageDirectoryBase(BaseModel):
    directory_path: str

class ImageDirectoryCreate(ImageDirectoryBase):
    reimbursement_data: Optional[List[dict]] = None

class ImageDirectory(ImageDirectoryBase):
    id: int
    status: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    processed_by: Optional[str] = None
    invoices: List[Invoice] = []

    class Config:
        from_attributes = True

class ReimbursementSheetBase(BaseModel):
    reimbursement_id: str
    invoice_code: str
    invoice_number: str
    amount: float
    applicant: Optional[str] = None
    department: Optional[str] = None

class ReimbursementSheetCreate(ReimbursementSheetBase):
    directory_id: int

class ReimbursementSheet(ReimbursementSheetBase):
    id: int
    directory_id: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class ArchiveReportBase(BaseModel):
    directory_id: int

class ArchiveReportCreate(ArchiveReportBase):
    pass

class ArchiveReport(ArchiveReportBase):
    id: int
    report_content: str
    total_files: int
    matched_count: int
    duplicate_count: int
    missing_count: int
    status: str
    created_at: datetime
    generated_by: Optional[str] = None

    class Config:
        from_attributes = True

class AuditLogBase(BaseModel):
    action: str
    original_input: str
    processed_by: str
    conclusion: str

class AuditLogCreate(AuditLogBase):
    directory_id: int
    invoice_id: Optional[int] = None

class AuditLog(AuditLogBase):
    id: int
    directory_id: int
    invoice_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True

class ManualCorrectionRequest(BaseModel):
    invoice_id: int
    invoice_code: Optional[str] = None
    invoice_number: Optional[str] = None
    reimbursement_id: Optional[str] = None
    amount: Optional[float] = None
    processed_by: str
    reason: str

class StatusUpdateRequest(BaseModel):
    status: str
    processed_by: str
    note: Optional[str] = None

class MatchingResult(BaseModel):
    invoice_id: int
    original_filename: str
    invoice_code: Optional[str]
    invoice_number: Optional[str]
    reimbursement_id: Optional[str]
    amount: Optional[float]
    match_status: str
    is_duplicate: bool
    duplicate_with: Optional[int]
    missing_fields: List[str]

class DirectoryOverview(BaseModel):
    directory_id: int
    directory_path: str
    status: str
    total_invoices: int
    matched_count: int
    duplicate_count: int
    pending_count: int
    missing_count: int
