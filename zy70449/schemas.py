from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Dict, Any

class RuleVersionBase(BaseModel):
    version: str
    rule_content: Dict[str, Any]
    description: Optional[str] = None
    created_by: str

class RuleVersionCreate(RuleVersionBase):
    pass

class RuleVersionResponse(RuleVersionBase):
    id: int
    created_at: datetime
    is_active: bool
    
    class Config:
        orm_mode = True

class BatchBase(BaseModel):
    batch_no: str
    operator: str
    department: str

class BatchCreate(BatchBase):
    pass

class BatchResponse(BatchBase):
    id: int
    rule_version_id: Optional[int] = None
    total_records: int
    valid_records: int
    invalid_records: int
    swallowed_records: int
    status: str
    created_at: datetime
    completed_at: Optional[datetime] = None
    rule_version: Optional[RuleVersionResponse] = None
    
    class Config:
        orm_mode = True

class InquiryFormBase(BaseModel):
    form_no: str
    supplier_name: str
    material_code: str
    material_name: str
    specification: Optional[str] = None
    quantity: float
    unit: str
    quoted_price: float
    currency: str = "CNY"
    delivery_period: Optional[str] = None
    payment_terms: Optional[str] = None
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None
    department: str
    applicant: str
    application_date: datetime
    remark: Optional[str] = None

class InquiryFormCreate(InquiryFormBase):
    pass

class InquiryFormProcessed(InquiryFormBase):
    id: int
    batch_id: int
    is_valid: bool
    risk_type: Optional[str] = None
    risk_level: Optional[str] = None
    risk_description: Optional[str] = None
    is_swallowed: bool
    swallow_reason: Optional[str] = None
    processing_result: str
    processing_message: Optional[str] = None
    processed_at: datetime
    
    class Config:
        orm_mode = True

class BatchWithForms(BatchResponse):
    inquiry_forms: List[InquiryFormProcessed] = []
    
    class Config:
        orm_mode = True

class ProcessingResult(BaseModel):
    batch_no: str
    total_processed: int
    valid_count: int
    invalid_count: int
    swallowed_count: int
    risk_summary: Dict[str, int]
    processing_time: float

class QueryFilter(BaseModel):
    batch_no: Optional[str] = None
    operator: Optional[str] = None
    risk_type: Optional[str] = None
    department: Optional[str] = None
    is_valid: Optional[bool] = None
    is_swallowed: Optional[bool] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None

class QueryResponse(BaseModel):
    total: int
    items: List[InquiryFormProcessed]

class BatchQueryFilter(BaseModel):
    batch_no: Optional[str] = None
    operator: Optional[str] = None
    department: Optional[str] = None
    status: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None

class RiskSummary(BaseModel):
    risk_type: str
    count: int
    level: str
