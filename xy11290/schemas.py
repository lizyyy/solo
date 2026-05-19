from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime
from models import MaterialType, MaterialStatus, TransferStatus, RecordSource


class BoothBase(BaseModel):
    booth_number: str
    company_name: Optional[str] = None
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None


class BoothCreate(BoothBase):
    pass


class Booth(BoothBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True


class MaterialBase(BaseModel):
    material_code: str
    name: str
    type: MaterialType
    specification: Optional[str] = None
    quantity_total: int = Field(ge=0)
    quantity_available: int = Field(ge=0)
    unit: str = "件"
    location: Optional[str] = None
    remark: Optional[str] = None

    @validator('quantity_available')
    def available_quantity_not_exceed_total(cls, v, values):
        if 'quantity_total' in values and v > values['quantity_total']:
            raise ValueError('可用数量不能大于总数量')
        return v


class MaterialCreate(MaterialBase):
    pass


class MaterialUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[MaterialType] = None
    specification: Optional[str] = None
    quantity_total: Optional[int] = Field(None, ge=0)
    quantity_available: Optional[int] = Field(None, ge=0)
    unit: Optional[str] = None
    location: Optional[str] = None
    remark: Optional[str] = None


class Material(MaterialBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True


class AllocationBase(BaseModel):
    allocation_code: str
    booth_id: int
    material_id: int
    quantity: int = Field(gt=0)
    status: MaterialStatus = MaterialStatus.ALLOCATED
    transfer_order_code: Optional[str] = None
    operator: Optional[str] = None
    remark: Optional[str] = None


class AllocationCreate(AllocationBase):
    pass


class Allocation(AllocationBase):
    id: int
    allocated_at: datetime
    returned_at: Optional[datetime] = None

    class Config:
        orm_mode = True


class TransferItemBase(BaseModel):
    material_id: int
    quantity: int = Field(gt=0)
    actual_quantity: Optional[int] = None


class TransferItemCreate(TransferItemBase):
    pass


class TransferItem(TransferItemBase):
    id: int
    order_id: int

    class Config:
        orm_mode = True


class TransferOrderBase(BaseModel):
    order_code: str
    source_location: Optional[str] = None
    target_location: Optional[str] = None
    status: TransferStatus = TransferStatus.PENDING
    operator: Optional[str] = None
    approver: Optional[str] = None
    remark: Optional[str] = None


class TransferOrderCreate(TransferOrderBase):
    items: List[TransferItemCreate]


class TransferOrder(TransferOrderBase):
    id: int
    created_at: datetime
    approved_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    items: List[TransferItem] = []

    class Config:
        orm_mode = True


class ReturnRecordBase(BaseModel):
    record_code: str
    material_id: int
    booth_id: Optional[int] = None
    allocation_id: Optional[int] = None
    quantity_returned: int = Field(ge=0)
    quantity_damaged: int = Field(ge=0, default=0)
    operator: Optional[str] = None
    remark: Optional[str] = None


class ReturnRecordCreate(ReturnRecordBase):
    pass


class ReturnRecord(ReturnRecordBase):
    id: int
    returned_at: datetime

    class Config:
        orm_mode = True


class LossRecordBase(BaseModel):
    record_code: str
    material_id: int
    quantity_lost: int = Field(ge=0)
    quantity_damaged: int = Field(ge=0, default=0)
    reason: Optional[str] = None
    responsible_person: Optional[str] = None
    operator: Optional[str] = None
    remark: Optional[str] = None


class LossRecordCreate(LossRecordBase):
    pass


class LossRecord(LossRecordBase):
    id: int
    recorded_at: datetime

    class Config:
        orm_mode = True


class InventoryLogBase(BaseModel):
    material_id: int
    change_type: str
    quantity_before: int
    quantity_change: int
    quantity_after: int
    operator: Optional[str] = None
    remark: Optional[str] = None
    source: Optional[RecordSource] = None
    related_record_code: Optional[str] = None


class InventoryLogCreate(InventoryLogBase):
    pass


class InventoryLog(InventoryLogBase):
    id: int
    created_at: datetime

    class Config:
        orm_mode = True


class ImportErrorRecordBase(BaseModel):
    import_batch: str
    source_type: RecordSource
    row_number: Optional[int] = None
    original_data: str
    error_message: str
    suggestion: Optional[str] = None


class ImportErrorRecordCreate(ImportErrorRecordBase):
    pass


class ImportErrorRecord(ImportErrorRecordBase):
    id: int
    resolved: int = 0
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        orm_mode = True


class ImportResult(BaseModel):
    success_count: int
    error_count: int
    batch_id: str
    errors: List[ImportErrorRecord] = []


class MaterialInventoryReport(BaseModel):
    material_code: str
    name: str
    type: MaterialType
    specification: Optional[str]
    quantity_total: int
    quantity_available: int
    quantity_allocated: int
    quantity_in_use: int
    quantity_returned: int
    quantity_lost: int
    quantity_damaged: int


class LossReportItem(BaseModel):
    material_code: str
    name: str
    type: MaterialType
    quantity_lost: int
    quantity_damaged: int
    loss_rate: float
    reason: Optional[str]
    responsible_person: Optional[str]


class LossReport(BaseModel):
    report_date: datetime
    total_materials: int
    total_lost: int
    total_damaged: int
    overall_loss_rate: float
    items: List[LossReportItem]


class BoothAllocationItem(BaseModel):
    booth_number: str
    company_name: Optional[str]
    material_code: str
    material_name: str
    material_type: MaterialType
    quantity: int
    status: MaterialStatus
    allocated_at: datetime


class GeneralLedgerReport(BaseModel):
    report_date: datetime
    initial_total: int
    total_allocated: int
    total_returned: int
    total_lost: int
    total_damaged: int
    final_total: int
    is_balanced: bool
    discrepancy: int
