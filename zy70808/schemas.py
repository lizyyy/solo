from pydantic import BaseModel, Field
from datetime import datetime, date
from typing import Optional, List
from models import RecordStatus, ExceptionType, ActionType


class BatchBase(BaseModel):
    name: str = Field(..., max_length=200)
    description: Optional[str] = None
    created_by: str = Field(..., max_length=100)


class BatchCreate(BatchBase):
    pass


class BatchResponse(BatchBase):
    id: int
    batch_number: str
    created_at: datetime
    updated_at: Optional[datetime]
    total_records: int
    exception_count: int

    class Config:
        from_attributes = True


class EquipmentBase(BaseModel):
    equipment_code: str = Field(..., max_length=100)
    name: str = Field(..., max_length=200)
    type: Optional[str] = None
    floor: Optional[str] = None
    area: Optional[str] = None
    location: Optional[str] = None
    installation_date: Optional[date] = None
    maintenance_person: Optional[str] = None
    last_inspection_date: Optional[date] = None
    next_inspection_date: Optional[date] = None


class EquipmentResponse(EquipmentBase):
    id: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class ContractBase(BaseModel):
    contract_number: str
    equipment_code: str
    vendor_name: Optional[str] = None
    start_date: date
    end_date: date
    contract_amount: Optional[int] = None
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None


class ContractResponse(ContractBase):
    id: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class PhotoBase(BaseModel):
    equipment_code: str
    file_name: Optional[str] = None
    inspection_date: Optional[date] = None
    photographer: Optional[str] = None
    description: Optional[str] = None


class PhotoResponse(PhotoBase):
    id: int
    photo_code: str
    uploaded_at: datetime

    class Config:
        from_attributes = True


class RecordExceptionResponse(BaseModel):
    id: int
    exception_type: str
    description: str
    detected_at: datetime

    class Config:
        from_attributes = True


class AuditLogResponse(BaseModel):
    id: int
    action_type: str
    action_by: str
    action_at: datetime
    from_status: Optional[str]
    to_status: Optional[str]
    reason: Optional[str]
    notes: Optional[str]

    class Config:
        from_attributes = True


class MaintenanceRecordBase(BaseModel):
    equipment_code: str
    equipment_name: str
    floor: Optional[str] = None
    area: Optional[str] = None
    maintenance_person: Optional[str] = None
    inspection_date: Optional[date] = None
    next_inspection_date: Optional[date] = None


class MaintenanceRecordResponse(MaintenanceRecordBase):
    id: int
    record_number: str
    batch_id: Optional[int]
    status: str
    has_exception: bool
    exception_types: Optional[str]
    exception_reason: Optional[str]
    readable_explanation: Optional[str]
    handled_by: Optional[str]
    handled_at: Optional[datetime]
    handler_notes: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
    exceptions: List[RecordExceptionResponse] = []
    audit_logs: List[AuditLogResponse] = []

    class Config:
        from_attributes = True


class RecordDetailResponse(MaintenanceRecordResponse):
    equipment: Optional[EquipmentResponse] = None
    contracts: List[ContractResponse] = []
    photos: List[PhotoResponse] = []


class HandleRecordRequest(BaseModel):
    action: str
    handled_by: str
    reason: Optional[str] = None
    notes: Optional[str] = None


class QueryParams(BaseModel):
    floor: Optional[str] = None
    area: Optional[str] = None
    maintenance_person: Optional[str] = None
    rectification_deadline_start: Optional[date] = None
    rectification_deadline_end: Optional[date] = None
    status: Optional[str] = None
    has_exception: Optional[bool] = None
    batch_id: Optional[int] = None
    page: int = 1
    page_size: int = 50


class PaginatedResponse(BaseModel):
    total: int
    page: int
    page_size: int
    data: List[MaintenanceRecordResponse]


class ImportResult(BaseModel):
    success: int
    failed: int
    errors: List[str]
    total: int
