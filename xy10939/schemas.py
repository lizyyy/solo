from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from models import BatchStatus, ClothingStatus, SterilizationMethod


class ClothingCategoryBase(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    sort_order: Optional[int] = 0


class ClothingCategoryCreate(ClothingCategoryBase):
    pass


class ClothingCategory(ClothingCategoryBase):
    id: int
    is_active: int
    created_at: datetime

    class Config:
        from_attributes = True


class DonationOrganizationBase(BaseModel):
    code: str
    name: str
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None
    address: Optional[str] = None
    description: Optional[str] = None


class DonationOrganizationCreate(DonationOrganizationBase):
    pass


class DonationOrganization(DonationOrganizationBase):
    id: int
    is_active: int
    created_at: datetime

    class Config:
        from_attributes = True


class RejectionReasonBase(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    sort_order: Optional[int] = 0


class RejectionReasonCreate(RejectionReasonBase):
    pass


class RejectionReason(RejectionReasonBase):
    id: int
    is_active: int

    class Config:
        from_attributes = True


class StatusHistoryBase(BaseModel):
    from_status: Optional[str] = None
    to_status: str
    operator: Optional[str] = None
    reason: Optional[str] = None


class StatusHistoryCreate(StatusHistoryBase):
    clothing_item_id: int


class StatusHistory(StatusHistoryBase):
    id: int
    clothing_item_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class SterilizationRecordBase(BaseModel):
    method: str
    temperature: Optional[float] = None
    duration: Optional[int] = None
    operator: Optional[str] = None
    result: str
    remark: Optional[str] = None


class SterilizationRecordCreate(SterilizationRecordBase):
    clothing_item_id: int


class SterilizationRecord(SterilizationRecordBase):
    id: int
    clothing_item_id: int
    record_no: str
    sterilized_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True


class DonationRecordBase(BaseModel):
    organization_id: int
    operator: Optional[str] = None
    receiver: Optional[str] = None
    remark: Optional[str] = None


class DonationRecordCreate(DonationRecordBase):
    clothing_item_id: int


class DonationRecord(DonationRecordBase):
    id: int
    clothing_item_id: int
    record_no: str
    donated_at: datetime
    created_at: datetime
    organization: DonationOrganization

    class Config:
        from_attributes = True


class RejectionRecordBase(BaseModel):
    reason_id: int
    operator: Optional[str] = None
    remark: Optional[str] = None


class RejectionRecordCreate(RejectionRecordBase):
    clothing_item_id: int


class RejectionRecord(RejectionRecordBase):
    id: int
    clothing_item_id: int
    record_no: str
    rejected_at: datetime
    created_at: datetime
    reason: RejectionReason

    class Config:
        from_attributes = True


class ClothingItemBase(BaseModel):
    name: str
    brand: Optional[str] = None
    color: Optional[str] = None
    size: Optional[str] = None
    material: Optional[str] = None
    quality_level: Optional[int] = None
    estimated_value: Optional[float] = None
    remark: Optional[str] = None


class ClothingItemCreate(ClothingItemBase):
    batch_id: int
    item_no: Optional[str] = None
    category_id: Optional[int] = None


class ClothingItemUpdate(BaseModel):
    category_id: Optional[int] = None
    name: Optional[str] = None
    brand: Optional[str] = None
    color: Optional[str] = None
    size: Optional[str] = None
    material: Optional[str] = None
    quality_level: Optional[int] = None
    estimated_value: Optional[float] = None
    remark: Optional[str] = None
    operator: Optional[str] = None


class ClothingItem(ClothingItemBase):
    id: int
    batch_id: int
    item_no: str
    category_id: Optional[int] = None
    status: str
    category: Optional[ClothingCategory] = None
    sterilization_records: List[SterilizationRecord] = []
    donation_records: List[DonationRecord] = []
    rejection_records: List[RejectionRecord] = []
    status_history: List[StatusHistory] = []
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DonationBatchBase(BaseModel):
    batch_no: Optional[str] = None
    donor_name: str
    donor_phone: Optional[str] = None
    donor_address: Optional[str] = None
    total_count: int
    remark: Optional[str] = None


class DonationBatchCreate(DonationBatchBase):
    pass


class DonationBatchUpdate(BaseModel):
    donor_name: Optional[str] = None
    donor_phone: Optional[str] = None
    donor_address: Optional[str] = None
    total_count: Optional[int] = None
    remark: Optional[str] = None


class DonationBatch(DonationBatchBase):
    id: int
    batch_no: str
    status: str
    received_at: datetime
    created_at: datetime
    updated_at: Optional[datetime] = None
    clothing_items: List[ClothingItem] = []

    class Config:
        from_attributes = True


class SortingReportBase(BaseModel):
    summary: Optional[str] = None
    operator: Optional[str] = None


class SortingReportCreate(SortingReportBase):
    batch_id: int


class SortingReport(SortingReportBase):
    id: int
    batch_id: int
    report_no: str
    total_count: int
    sorted_count: int
    sterilized_count: int
    donated_count: int
    rejected_count: int
    pending_count: int
    generated_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True


class ProcessingExceptionBase(BaseModel):
    original_input: str
    error_message: Optional[str] = None
    processing_step: Optional[str] = None
    conclusion: Optional[str] = None
    operator: Optional[str] = None


class ProcessingExceptionCreate(ProcessingExceptionBase):
    batch_id: Optional[int] = None
    clothing_item_id: Optional[int] = None


class ProcessingExceptionResolve(BaseModel):
    conclusion: str
    resolution_note: Optional[str] = None
    operator: Optional[str] = None


class ProcessingException(ProcessingExceptionBase):
    id: int
    exception_no: str
    batch_id: Optional[int] = None
    clothing_item_id: Optional[int] = None
    resolved: int
    resolved_at: Optional[datetime] = None
    resolution_note: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class StatusTransitionRequest(BaseModel):
    target_status: str
    operator: Optional[str] = None
    reason: Optional[str] = None


class BatchDetailResponse(BaseModel):
    batch: DonationBatch
    statistics: dict

    class Config:
        from_attributes = True


class ClothingDetailResponse(BaseModel):
    item: ClothingItem
    related_records: dict

    class Config:
        from_attributes = True
