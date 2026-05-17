from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List


class EmployeeBase(BaseModel):
    employee_id: str
    name: str
    department: Optional[str] = None
    position: Optional[str] = None
    card_number: str


class EmployeeCreate(EmployeeBase):
    pass


class Employee(EmployeeBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class DoorAreaBase(BaseModel):
    name: str
    building: str
    floor: str
    description: Optional[str] = None


class DoorAreaCreate(DoorAreaBase):
    pass


class DoorArea(DoorAreaBase):
    id: int

    class Config:
        from_attributes = True


class AccessLogBase(BaseModel):
    card_number: str
    door_area_id: int
    swipe_time: datetime
    access_type: str
    original_data: Optional[str] = None


class AccessLogCreate(AccessLogBase):
    pass


class AccessLog(AccessLogBase):
    id: int
    created_at: datetime
    door_area: Optional[DoorArea] = None

    class Config:
        from_attributes = True


class WhitelistBase(BaseModel):
    card_number: str
    employee_id: Optional[str] = None
    reason: str
    created_by: str


class WhitelistCreate(WhitelistBase):
    pass


class Whitelist(WhitelistBase):
    id: int
    created_at: datetime
    is_active: bool

    class Config:
        from_attributes = True


class DetectionTaskBase(BaseModel):
    name: str
    time_window_minutes: int = 60
    created_by: Optional[str] = None


class DetectionTaskCreate(DetectionTaskBase):
    pass


class DetectionTask(DetectionTaskBase):
    id: int
    status: str
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    total_anomalies: int

    class Config:
        from_attributes = True


class AnomalyRecordBase(BaseModel):
    pass


class AnomalyRecord(AnomalyRecordBase):
    id: int
    task_id: int
    card_number: str
    employee_id: Optional[str] = None
    employee_name: Optional[str] = None
    first_door_area: str
    second_door_area: str
    first_swipe_time: datetime
    second_swipe_time: datetime
    time_diff_minutes: float
    status: str
    created_at: datetime
    updated_at: datetime
    current_handler: Optional[str] = None
    final_conclusion: Optional[str] = None
    is_confirmed_anomaly: Optional[bool] = None
    close_reason: Optional[str] = None
    closed_by: Optional[str] = None
    closed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AnomalyRecordDetail(AnomalyRecord):
    first_log: Optional[AccessLog] = None
    second_log: Optional[AccessLog] = None


class StatusUpdateRequest(BaseModel):
    status: str
    handler: str
    remark: Optional[str] = None


class CorrectRequest(BaseModel):
    conclusion: str
    is_anomaly: bool
    handler: str
    remark: Optional[str] = None


class CloseRequest(BaseModel):
    reason: str
    handler: str


class AnomalyHistoryBase(BaseModel):
    pass


class AnomalyHistory(AnomalyHistoryBase):
    id: int
    anomaly_id: int
    action: str
    old_status: Optional[str] = None
    new_status: Optional[str] = None
    handler: str
    remark: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class PaginatedResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List


class AnomalyPaginatedResponse(PaginatedResponse):
    items: List[AnomalyRecord]
