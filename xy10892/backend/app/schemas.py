from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional

class DocumentBase(BaseModel):
    filename: str

class DocumentCreate(DocumentBase):
    content: Optional[str] = None

class DocumentContentUpdate(BaseModel):
    content: str

class Document(DocumentBase):
    id: int
    file_size: Optional[int] = None
    content: Optional[str] = None
    masked_content: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime
    error_message: Optional[str] = None
    
    class Config:
        from_attributes = True

class DocumentDetail(Document):
    hit_count: int = 0
    review_count: int = 0
    version_count: int = 0

class MaskingRuleBase(BaseModel):
    name: str
    rule_type: str
    pattern: str
    replacement: str = "***"

class MaskingRuleCreate(MaskingRuleBase):
    pass

class MaskingRule(MaskingRuleBase):
    id: int
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class SensitiveHitBase(BaseModel):
    matched_text: str
    line_number: Optional[int] = None
    context: Optional[str] = None

class SensitiveHit(SensitiveHitBase):
    id: int
    document_id: int
    rule_id: Optional[int] = None
    status: str
    created_at: datetime
    
    class Config:
        from_attributes = True

class ReviewBase(BaseModel):
    reviewer: str
    comment: Optional[str] = None
    decision: str

class ReviewCreate(ReviewBase):
    pass

class Review(ReviewBase):
    id: int
    document_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class ExportVersionBase(BaseModel):
    version_number: str

class ExportVersion(ExportVersionBase):
    id: int
    document_id: int
    file_path: Optional[str] = None
    report_path: Optional[str] = None
    is_authorized: bool
    authorized_by: Optional[str] = None
    authorized_at: Optional[datetime] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class DownloadRecordBase(BaseModel):
    downloaded_by: str
    ip_address: Optional[str] = None

class DownloadRecord(DownloadRecordBase):
    id: int
    version_id: int
    downloaded_at: datetime
    
    class Config:
        from_attributes = True

class StatusHistoryBase(BaseModel):
    from_status: Optional[str] = None
    to_status: str
    message: Optional[str] = None

class StatusHistory(StatusHistoryBase):
    id: int
    document_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class StatusUpdate(BaseModel):
    status: str
    message: Optional[str] = None

class DocumentWithDetails(Document):
    hits: List[SensitiveHit] = []
    reviews: List[Review] = []
    versions: List[ExportVersion] = []
    status_history: List[StatusHistory] = []
    
    class Config:
        from_attributes = True
