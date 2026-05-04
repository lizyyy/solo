from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime


class ClaimDocumentBase(BaseModel):
    claim_id: int
    document_type: str
    document_name: str
    file_path: Optional[str] = None
    is_submitted: bool = False
    submitted_date: Optional[date] = None
    is_required: bool = True
    notes: Optional[str] = None


class ClaimDocumentCreate(ClaimDocumentBase):
    pass


class ClaimDocumentUpdate(ClaimDocumentBase):
    claim_id: Optional[int] = None
    document_type: Optional[str] = None
    document_name: Optional[str] = None


class ClaimDocumentResponse(ClaimDocumentBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
