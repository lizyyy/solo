from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, Field

from app.models import AppointmentStatus, StorageStatus, InspectionStatus, SkipType


class ColdStorageBayBase(BaseModel):
    bay_code: str = Field(..., max_length=20)
    bay_name: str = Field(..., max_length=100)
    zone: str = Field(..., max_length=50)
    temperature_zone: str = Field(..., max_length=50)
    capacity_cubic_meters: float
    notes: Optional[str] = None


class ColdStorageBayCreate(ColdStorageBayBase):
    pass


class ColdStorageBayResponse(ColdStorageBayBase):
    id: int
    status: StorageStatus
    current_appointment_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class InspectionWindowBase(BaseModel):
    window_code: str = Field(..., max_length=20)
    window_name: str = Field(..., max_length=100)
    capacity_per_hour: int = 5
    is_active: bool = True
    notes: Optional[str] = None


class InspectionWindowCreate(InspectionWindowBase):
    pass


class InspectionWindowResponse(InspectionWindowBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AppointmentBase(BaseModel):
    customer_name: str = Field(..., max_length=100)
    contact_phone: str = Field(..., max_length=20)
    license_plate: str = Field(..., max_length=20)
    driver_name: str = Field(..., max_length=50)
    product_type: str = Field(..., max_length=100)
    product_name: str = Field(..., max_length=200)
    quantity: float
    unit: str = Field(..., max_length=20)
    volume_cubic_meters: float
    temperature_requirement: str = Field(..., max_length=50)
    scheduled_date: date
    scheduled_time_slot: str = Field(..., max_length=20)
    priority: int = 0
    notes: Optional[str] = None


class AppointmentCreate(AppointmentBase):
    pass


class AppointmentResponse(AppointmentBase):
    id: int
    appointment_no: str
    status: AppointmentStatus
    storage_bay_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AppointmentDetailResponse(AppointmentResponse):
    storage_bay: Optional[ColdStorageBayResponse] = None
    queue_position: Optional[int] = None
    expected_wait_minutes: Optional[int] = None


class StorageLockResponse(BaseModel):
    id: int
    appointment_id: int
    storage_bay_id: int
    bay_code: str
    locked_at: datetime
    lock_expiry_time: datetime
    is_released: bool
    released_at: Optional[datetime] = None
    release_reason: Optional[str] = None

    class Config:
        from_attributes = True


class InspectionQueueResponse(BaseModel):
    id: int
    appointment_id: int
    inspection_window_id: int
    window_code: str
    queue_number: int
    queue_date: date
    status: InspectionStatus
    checked_in_time: Optional[datetime] = None
    inspection_start_time: Optional[datetime] = None
    inspection_end_time: Optional[datetime] = None
    expected_wait_minutes: Optional[int] = None
    actual_wait_minutes: Optional[int] = None
    inspector_name: Optional[str] = None
    inspection_notes: Optional[str] = None

    class Config:
        from_attributes = True


class SkipRecordResponse(BaseModel):
    id: int
    appointment_id: int
    skip_type: SkipType
    skip_time: datetime
    skip_reason: str
    original_queue_number: int
    new_queue_number: Optional[int] = None
    is_reassigned: bool
    operator_name: Optional[str] = None

    class Config:
        from_attributes = True


class LoadingReceiptBase(BaseModel):
    actual_quantity: float
    actual_volume: float
    temperature_reading: Optional[float] = None
    handler_name: Optional[str] = None
    acceptance_status: str = "accepted"
    discrepancy_notes: Optional[str] = None


class LoadingReceiptCreate(LoadingReceiptBase):
    pass


class LoadingReceiptResponse(LoadingReceiptBase):
    id: int
    appointment_id: int
    receipt_no: str
    storage_bay_id: int
    bay_code: str
    loading_start_time: Optional[datetime] = None
    loading_end_time: Optional[datetime] = None
    customer_confirmation: bool
    confirmed_by: Optional[str] = None
    confirmed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class FailedTaskResponse(BaseModel):
    id: int
    appointment_id: int
    appointment_no: str
    task_type: str
    task_description: str
    error_message: str
    error_details: Optional[str] = None
    occurred_at: datetime
    retry_count: int
    max_retries: int
    last_retry_at: Optional[datetime] = None
    is_resolved: bool
    resolved_at: Optional[datetime] = None
    resolution_notes: Optional[str] = None

    class Config:
        from_attributes = True


class CheckInRequest(BaseModel):
    appointment_no: str


class InspectionResultRequest(BaseModel):
    inspection_status: InspectionStatus
    inspector_name: str
    notes: Optional[str] = None


class SkipRequest(BaseModel):
    skip_type: SkipType
    skip_reason: str
    operator_name: Optional[str] = None


class RetryRequest(BaseModel):
    operator_name: Optional[str] = None


class QueueStatisticsResponse(BaseModel):
    total_waiting: int
    total_in_inspection: int
    total_completed_today: int
    total_skipped_today: int
    average_wait_minutes: float
    current_queue: List[InspectionQueueResponse]


class ExportRequest(BaseModel):
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[AppointmentStatus] = None


class BatchRetryRequest(BaseModel):
    task_ids: List[int]
    operator_name: Optional[str] = None


class ConfirmReceiptRequest(BaseModel):
    confirmed_by: str
