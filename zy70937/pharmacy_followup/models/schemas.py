from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, date


class CustomerBase(BaseModel):
    customer_id: str
    name: str
    phone: Optional[str] = None
    id_card: Optional[str] = None
    disease_type: Optional[str] = None
    birthday: Optional[str] = None
    address: Optional[str] = None


class CustomerCreate(CustomerBase):
    pass


class CustomerResponse(BaseModel):
    customer_id: str
    name: str
    phone_masked: Optional[str] = None
    id_card_masked: Optional[str] = None
    disease_type: Optional[str] = None
    birthday: Optional[str] = None
    address_masked: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class PurchaseRecordBase(BaseModel):
    record_id: str
    customer_id: str
    drug_name: str
    drug_spec: Optional[str] = None
    purchase_date: date
    quantity: Optional[int] = None
    dosage: Optional[str] = None
    doctor: Optional[str] = None


class PurchaseRecordCreate(PurchaseRecordBase):
    pass


class PurchaseRecordResponse(BaseModel):
    record_id: str
    customer_id: str
    drug_name: str
    drug_spec: Optional[str] = None
    purchase_date: date
    quantity: Optional[int] = None
    dosage: Optional[str] = None
    doctor: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class FollowupRuleBase(BaseModel):
    rule_id: str
    rule_type: str
    disease_type: Optional[str] = None
    drug_name: Optional[str] = None
    interval_days: Optional[int] = None
    forbidden_drugs: Optional[List[str]] = None
    description: Optional[str] = None


class FollowupRuleCreate(FollowupRuleBase):
    pass


class FollowupRuleResponse(FollowupRuleBase):
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ProcessedRecordResponse(BaseModel):
    id: int
    batch_id: Optional[int] = None
    record_type: str
    source_id: Optional[str] = None
    status: str
    result_category: str
    raw_data: Optional[Dict[str, Any]] = None
    processed_data: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    suggestion: Optional[str] = None
    rule_matched: Optional[List[str]] = None
    trace_id: str
    created_at: datetime

    class Config:
        from_attributes = True


class BatchResponse(BaseModel):
    id: int
    batch_no: str
    source_type: str
    file_name: Optional[str] = None
    total_records: int
    processed_at: datetime
    status: str

    class Config:
        from_attributes = True


class UploadResponse(BaseModel):
    batch_no: str
    total_records: int
    normal_count: int
    pending_count: int
    failed_count: int
    normal: List[ProcessedRecordResponse] = []
    pending: List[ProcessedRecordResponse] = []
    failed: List[ProcessedRecordResponse] = []
    is_duplicate: Optional[bool] = None
    message: Optional[str] = None

    model_config = {"extra": "allow"}


class FollowupReminderResponse(BaseModel):
    reminder_id: str
    customer_id: str
    customer_name: str
    drug_name: str
    last_purchase_date: Optional[date] = None
    next_followup_date: Optional[date] = None
    reminder_type: str
    content: str
    status: str
    trace_id: str
    report_id: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ReportResponse(BaseModel):
    report_id: str
    batch_no: str
    generated_at: datetime
    summary: Dict[str, Any]
    reminders: List[FollowupReminderResponse] = []


class TraceDetailResponse(BaseModel):
    trace_id: str
    reminder: Optional[FollowupReminderResponse] = None
    processed_record: Optional[ProcessedRecordResponse] = None
    purchase_record: Optional[PurchaseRecordResponse] = None
    customer: Optional[CustomerResponse] = None
