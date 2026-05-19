from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


class OrderBase(BaseModel):
    order_no: str
    property_name: str
    guest_name: Optional[str] = None
    check_in_date: Optional[datetime] = None
    check_out_date: Optional[datetime] = None


class OrderCreate(OrderBase):
    pass


class Order(OrderBase):
    id: int
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CleanerBase(BaseModel):
    name: str
    phone: Optional[str] = None
    base_salary: float = 0


class CleanerCreate(CleanerBase):
    pass


class Cleaner(CleanerBase):
    id: int
    score: float
    created_at: datetime

    class Config:
        from_attributes = True


class CleaningTaskBase(BaseModel):
    task_no: str
    order_id: int
    cleaner_id: int
    deadline: datetime
    base_fee: float = 0


class CleaningTaskCreate(CleaningTaskBase):
    pass


class CleaningTask(CleaningTaskBase):
    id: int
    assigned_at: datetime
    status: str
    deduction_amount: float
    final_fee: float
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CleaningPhotoBase(BaseModel):
    task_id: int
    photo_type: str
    photo_url: Optional[str] = None
    uploaded_by: Optional[str] = None


class CleaningPhotoCreate(CleaningPhotoBase):
    pass


class CleaningPhoto(CleaningPhotoBase):
    id: int
    uploaded_at: datetime

    class Config:
        from_attributes = True


class InspectionBase(BaseModel):
    task_id: int
    inspector: Optional[str] = None
    passed: bool
    comments: Optional[str] = None
    reason: Optional[str] = None


class InspectionCreate(InspectionBase):
    pass


class Inspection(InspectionBase):
    id: int
    inspected_at: datetime

    class Config:
        from_attributes = True


class ReworkBase(BaseModel):
    task_id: int
    requested_by: Optional[str] = None
    reason: str
    deadline: Optional[datetime] = None
    affects_settlement: bool = True


class ReworkCreate(ReworkBase):
    pass


class ReworkComplete(BaseModel):
    completed: bool = True


class Rework(ReworkBase):
    id: int
    requested_at: datetime
    completed_at: Optional[datetime] = None
    completed: bool

    class Config:
        from_attributes = True


class DeductionBase(BaseModel):
    task_id: int
    deduction_type: str
    amount: float
    reason: str
    applied_by: Optional[str] = None


class DeductionCreate(DeductionBase):
    pass


class Deduction(DeductionBase):
    id: int
    applied_at: datetime

    class Config:
        from_attributes = True


class SettlementItemBase(BaseModel):
    task_id: int
    base_fee: float
    deductions: float
    final_fee: float
    remarks: Optional[str] = None


class SettlementItemCreate(SettlementItemBase):
    pass


class SettlementItem(SettlementItemBase):
    id: int

    class Config:
        from_attributes = True


class SettlementBase(BaseModel):
    settlement_no: str
    order_id: int
    cleaner_id: int


class SettlementCreate(SettlementBase):
    pass


class SettlementFinalize(BaseModel):
    notes: Optional[str] = None


class Settlement(SettlementBase):
    id: int
    total_base_fee: float
    total_deductions: float
    final_amount: float
    status: str
    settled_at: Optional[datetime] = None
    created_at: datetime
    notes: Optional[str] = None
    items: List[SettlementItem] = []

    class Config:
        from_attributes = True


class BatchResult(BaseModel):
    success: int
    failed: int
    successful_items: List[dict] = []
    failed_items: List[dict] = []


class TaskDetailResponse(BaseModel):
    task: CleaningTask
    photos: List[CleaningPhoto]
    inspections: List[Inspection]
    reworks: List[Rework]
    deductions: List[Deduction]