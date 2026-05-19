from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from typing import Optional, List, Any
from app.models.models import UserRole, WorkOrderStatus, InspectionResult


class UserBase(BaseModel):
    username: str = Field(..., max_length=50)
    real_name: Optional[str] = Field(None, max_length=50)
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=100)
    role: UserRole = UserRole.WORKER


class UserCreate(UserBase):
    password: str = Field(..., min_length=6)


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class PumpRoomBase(BaseModel):
    code: str = Field(..., max_length=50)
    name: str = Field(..., max_length=100)
    location: Optional[str] = Field(None, max_length=255)
    building: Optional[str] = Field(None, max_length=100)
    floor: Optional[str] = Field(None, max_length=50)
    equipment_count: int = 0
    status: str = "active"
    description: Optional[str] = None


class PumpRoomCreate(PumpRoomBase):
    pass


class PumpRoomResponse(PumpRoomBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class InspectionRecordBase(BaseModel):
    pump_room_id: int
    inspection_time: datetime
    water_pressure: Optional[float] = None
    water_level: Optional[float] = None
    pump_status: Optional[str] = Field(None, max_length=50)
    valve_status: Optional[str] = Field(None, max_length=50)
    pipe_status: Optional[str] = Field(None, max_length=50)
    electrical_status: Optional[str] = Field(None, max_length=50)
    temperature: Optional[float] = None
    humidity: Optional[float] = None
    noise_level: Optional[float] = None
    result: InspectionResult = InspectionResult.PENDING
    issues: Optional[str] = None
    remarks: Optional[str] = None


class InspectionRecordCreate(InspectionRecordBase):
    record_no: Optional[str] = None
    import_id: Optional[str] = None
    import_batch: Optional[str] = None


class InspectionRecordImport(InspectionRecordBase):
    pump_room_code: str
    inspector_username: Optional[str] = None


class InspectionRecordResponse(InspectionRecordBase):
    id: int
    record_no: str
    import_id: Optional[str]
    import_batch: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
    pump_room: Optional[PumpRoomResponse] = None
    inspector: Optional[UserResponse] = None
    
    class Config:
        from_attributes = True


class WorkOrderBase(BaseModel):
    title: str = Field(..., max_length=200)
    description: Optional[str] = None
    priority: int = 2
    issue_type: Optional[str] = Field(None, max_length=50)


class WorkOrderCreate(WorkOrderBase):
    pump_room_id: int
    inspection_record_id: Optional[int] = None


class WorkOrderAssign(BaseModel):
    assigned_to: int


class WorkOrderArrive(BaseModel):
    arrival_photo: Optional[str] = None


class WorkOrderReinspect(BaseModel):
    reinspection_result: str
    repair_description: Optional[str] = None


class WorkOrderClose(BaseModel):
    close_reason: Optional[str] = None


class WorkOrderResponse(WorkOrderBase):
    id: int
    order_no: str
    pump_room_id: int
    inspection_record_id: Optional[int]
    created_by: int
    assigned_to: Optional[int]
    status: WorkOrderStatus
    assigned_at: Optional[datetime]
    arrived_at: Optional[datetime]
    reinspected_at: Optional[datetime]
    closed_at: Optional[datetime]
    arrival_photo: Optional[str]
    repair_description: Optional[str]
    reinspection_result: Optional[str]
    close_reason: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
    pump_room: Optional[PumpRoomResponse] = None
    assigned_user: Optional[UserResponse] = None
    creator_user: Optional[UserResponse] = None
    
    class Config:
        from_attributes = True


class HistoryLogResponse(BaseModel):
    id: int
    work_order_id: Optional[int]
    user_id: Optional[int]
    action: str
    from_status: Optional[str]
    to_status: Optional[str]
    description: Optional[str]
    ip_address: Optional[str]
    created_at: datetime
    user: Optional[UserResponse] = None
    
    class Config:
        from_attributes = True


class ImportRecordResponse(BaseModel):
    id: int
    batch_no: str
    file_name: Optional[str]
    total_count: int
    success_count: int
    failed_count: int
    duplicate_count: int
    status: str
    error_message: Optional[str]
    created_at: datetime
    completed_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class ApiResponse(BaseModel):
    code: int = 200
    message: str = "success"
    data: Optional[Any] = None


class PaginatedResponse(BaseModel):
    code: int = 200
    message: str = "success"
    data: List[Any]
    total: int
    page: int
    page_size: int
