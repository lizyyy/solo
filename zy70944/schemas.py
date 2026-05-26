from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class OwnerBase(BaseModel):
    room_number: str
    owner_name: str
    phone: Optional[str] = None
    deposit_amount: float = 0


class OwnerCreate(OwnerBase):
    pass


class OwnerResponse(OwnerBase):
    id: int
    deposit_frozen: bool = False
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RenovationApplicationBase(BaseModel):
    batch_id: str
    room_number: str
    applicant_name: Optional[str] = None
    apply_date: Optional[str] = None
    renovation_type: Optional[str] = None
    contractor: Optional[str] = None
    deposit_amount: float = 0
    remark: Optional[str] = None


class RenovationApplicationCreate(RenovationApplicationBase):
    owner_id: Optional[int] = None


class RenovationApplicationUpdate(BaseModel):
    status: Optional[str] = None
    remark: Optional[str] = None


class RenovationApplicationResponse(RenovationApplicationBase):
    id: int
    owner_id: int
    status: str
    source_file: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class InspectionBase(BaseModel):
    batch_id: str
    room_number: str
    inspector: Optional[str] = None
    inspect_date: Optional[str] = None
    inspect_result: Optional[str] = None
    violations: Optional[str] = None
    rectification_required: bool = False
    remark: Optional[str] = None


class InspectionCreate(InspectionBase):
    owner_id: Optional[int] = None
    application_id: Optional[int] = None


class InspectionUpdate(BaseModel):
    status: Optional[str] = None
    remark: Optional[str] = None


class InspectionResponse(InspectionBase):
    id: int
    owner_id: int
    application_id: Optional[int] = None
    status: str
    source_file: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DeductionRuleBase(BaseModel):
    rule_code: str
    rule_name: str
    violation_type: Optional[str] = None
    deduction_amount: float
    description: Optional[str] = None


class DeductionRuleCreate(DeductionRuleBase):
    pass


class DeductionRuleResponse(DeductionRuleBase):
    id: int
    is_active: bool = True
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProcessingRecordBase(BaseModel):
    action_type: str
    previous_status: Optional[str] = None
    new_status: Optional[str] = None
    reason: Optional[str] = None
    processor: str
    remark: Optional[str] = None


class ProcessingRecordCreate(ProcessingRecordBase):
    application_id: Optional[int] = None
    inspection_id: Optional[int] = None
    room_number: Optional[str] = None


class ProcessingRecordResponse(ProcessingRecordBase):
    id: int
    room_number: Optional[str] = None
    processing_time: datetime

    class Config:
        from_attributes = True


class RefundRecordBase(BaseModel):
    refund_code: str
    room_number: str
    owner_name: Optional[str] = None
    refund_amount: float
    refund_reason: Optional[str] = None
    related_batch_id: Optional[str] = None


class RefundRecordCreate(RefundRecordBase):
    pass


class RefundRecordUpdate(BaseModel):
    approval_status: Optional[str] = None
    approver: Optional[str] = None
    is_duplicate: Optional[bool] = None
    remark: Optional[str] = None


class RefundRecordResponse(RefundRecordBase):
    id: int
    approval_status: str
    approver: Optional[str] = None
    approval_time: Optional[datetime] = None
    is_duplicate: bool = False
    remark: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BatchImportResponse(BaseModel):
    batch_id: str
    total_count: int
    success_count: int
    failed_count: int
    failed_details: List[dict] = []


class ExportQuery(BaseModel):
    room_number: Optional[str] = None
    batch_id: Optional[str] = None
    status: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class ProcessingAction(BaseModel):
    action_type: str
    processor: str
    reason: Optional[str] = None
    remark: Optional[str] = None
