from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from models import ProcessingStatus, ChangeStatus


class CustomerBase(BaseModel):
    name: str = Field(..., max_length=100)
    phone: str = Field(..., max_length=20)
    email: Optional[str] = Field(None, max_length=100)
    wechat: Optional[str] = Field(None, max_length=50)


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(CustomerBase):
    pass


class Customer(CustomerBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        orm_mode = True


class PrescriptionBase(BaseModel):
    optometrist: Optional[str] = Field(None, max_length=100)
    exam_date: datetime
    expires_at: Optional[datetime] = None

    od_sphere: float
    od_cylinder: Optional[float] = 0
    od_axis: Optional[int] = 0
    od_add: Optional[float] = None

    os_sphere: float
    os_cylinder: Optional[float] = 0
    os_axis: Optional[int] = 0
    os_add: Optional[float] = None

    pd_distance: Optional[float] = None
    pd_near: Optional[float] = None

    notes: Optional[str] = None


class PrescriptionCreate(PrescriptionBase):
    customer_id: int
    created_by: Optional[str] = None


class PrescriptionUpdate(PrescriptionBase):
    is_active: Optional[bool] = None


class Prescription(PrescriptionBase):
    id: int
    customer_id: int
    version: int
    is_active: bool
    created_at: datetime
    created_by: Optional[str]

    class Config:
        orm_mode = True


class FrameBase(BaseModel):
    sku: str = Field(..., max_length=50)
    brand: str = Field(..., max_length=100)
    model: str = Field(..., max_length=100)
    color: Optional[str] = Field(None, max_length=50)
    material: Optional[str] = Field(None, max_length=50)
    size: Optional[str] = Field(None, max_length=50)
    bridge: Optional[str] = Field(None, max_length=20)
    temple_length: Optional[str] = Field(None, max_length=20)
    quantity: Optional[int] = 0
    price: Optional[float] = None
    location: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None


class FrameCreate(FrameBase):
    pass


class FrameUpdate(FrameBase):
    pass


class Frame(FrameBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        orm_mode = True


class LensOrderBase(BaseModel):
    lens_type_od: str = Field(..., max_length=100)
    lens_type_os: str = Field(..., max_length=100)
    lens_brand: Optional[str] = Field(None, max_length=100)
    lens_coating: Optional[str] = Field(None, max_length=100)
    rush_order: Optional[bool] = False
    priority_level: Optional[int] = 1
    notes: Optional[str] = None
    estimated_completion: Optional[datetime] = None
    pickup_deadline: Optional[datetime] = None


class LensOrderCreate(LensOrderBase):
    customer_id: int
    prescription_id: int
    frame_id: Optional[int] = None
    created_by: Optional[str] = None


class LensOrderUpdate(LensOrderBase):
    status: Optional[ProcessingStatus] = None


class LensOrderStatusUpdate(BaseModel):
    status: ProcessingStatus
    changed_by: str
    notes: Optional[str] = None


class LensOrder(LensOrderBase):
    id: int
    order_no: str
    customer_id: int
    prescription_id: int
    frame_id: Optional[int]
    status: ProcessingStatus
    status_updated_at: datetime
    status_updated_by: Optional[str]
    pickup_reminder_sent: bool
    created_at: datetime
    updated_at: Optional[datetime]
    created_by: Optional[str]

    class Config:
        orm_mode = True


class LensOrderDetail(LensOrder):
    customer: Customer
    prescription: Prescription
    frame: Optional[Frame]


class DegreeChangeRequest(BaseModel):
    lens_order_id: int
    reason: str
    requested_by: str

    od_sphere: Optional[float] = None
    od_cylinder: Optional[float] = None
    od_axis: Optional[int] = None
    od_add: Optional[float] = None

    os_sphere: Optional[float] = None
    os_cylinder: Optional[float] = None
    os_axis: Optional[int] = None
    os_add: Optional[float] = None

    pd_distance: Optional[float] = None
    pd_near: Optional[float] = None


class DegreeChangeReview(BaseModel):
    status: ChangeStatus
    reviewed_by: str
    review_notes: Optional[str] = None


class DegreeChangeRecord(BaseModel):
    id: int
    lens_order_id: int
    prescription_id: int
    new_prescription_id: Optional[int]
    change_type: str
    original_value: Optional[str]
    new_value: Optional[str]
    reason: str
    status: ChangeStatus
    can_apply: bool
    interception_reason: Optional[str]
    requested_by: str
    requested_at: datetime
    reviewed_by: Optional[str]
    reviewed_at: Optional[datetime]
    review_notes: Optional[str]
    applied_at: Optional[datetime]
    applied_by: Optional[str]
    raw_input: Optional[str]
    processing_conclusion: Optional[str]

    class Config:
        orm_mode = True


class ProcessingStatusHistory(BaseModel):
    id: int
    lens_order_id: int
    from_status: Optional[str]
    to_status: str
    changed_by: str
    changed_at: datetime
    notes: Optional[str]

    class Config:
        orm_mode = True


class PickupReportBase(BaseModel):
    final_check_by: Optional[str] = None
    check_notes: Optional[str] = None
    quality_pass: bool = True
    defects_found: Optional[str] = None


class PickupReportCreate(PickupReportBase):
    lens_order_id: int


class PickupReportUpdate(PickupReportBase):
    pass


class PickupReminder(BaseModel):
    reminder_type: str = Field(..., description="first, second, or custom")
    sent_by: str
    notes: Optional[str] = None


class PickupConfirmation(BaseModel):
    picked_up_by: str
    pickup_notes: Optional[str] = None


class PickupReport(BaseModel):
    id: int
    lens_order_id: int
    report_no: str
    final_check_by: Optional[str]
    final_check_date: Optional[datetime]
    check_notes: Optional[str]
    pickup_ready_date: Optional[datetime]
    first_reminder_sent: bool
    first_reminder_date: Optional[datetime]
    second_reminder_sent: bool
    second_reminder_date: Optional[datetime]
    picked_up: bool
    pickup_date: Optional[datetime]
    picked_up_by: Optional[str]
    pickup_notes: Optional[str]
    quality_pass: bool
    defects_found: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        orm_mode = True


class OrderWithdraw(BaseModel):
    reason: str
    changed_by: str


class ManualCorrection(BaseModel):
    field_name: str
    old_value: str
    new_value: str
    reason: str
    corrected_by: str


class ErrorResponse(BaseModel):
    error_code: str
    message: str
    details: Optional[dict] = None
    timestamp: datetime


class PaginationResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List


class ExportFilter(BaseModel):
    status: Optional[List[ProcessingStatus]] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    customer_id: Optional[int] = None
