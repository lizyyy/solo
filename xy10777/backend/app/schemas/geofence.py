from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime

class GeofenceBase(BaseModel):
    name: str
    description: Optional[str] = None
    fence_type: str = "polygon"
    coordinates: List[Any]
    radius: Optional[float] = None
    is_active: bool = True

class GeofenceCreate(GeofenceBase):
    pass

class GeofenceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    fence_type: Optional[str] = None
    coordinates: Optional[List[Any]] = None
    radius: Optional[float] = None
    is_active: Optional[bool] = None

class GeofenceResponse(GeofenceBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class DeviceBase(BaseModel):
    device_id: str
    name: Optional[str] = None
    device_type: Optional[str] = None
    is_active: bool = True

class DeviceCreate(DeviceBase):
    pass

class DeviceResponse(DeviceBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class DevicePositionBase(BaseModel):
    device_id: int
    latitude: float
    longitude: float
    altitude: Optional[float] = None
    speed: Optional[float] = None
    direction: Optional[float] = None
    accuracy: Optional[float] = None
    timestamp: datetime
    is_valid: bool = True
    source: Optional[str] = None

class DevicePositionCreate(DevicePositionBase):
    pass

class DevicePositionResponse(DevicePositionBase):
    id: int

    class Config:
        from_attributes = True

class AlertEventBase(BaseModel):
    geofence_id: int
    device_id: int
    event_type: str
    timestamp: datetime
    position_id: int
    is_false_alarm: bool = False
    is_verified: bool = False
    notes: Optional[str] = None
    confidence: float = 1.0

class AlertEventCreate(AlertEventBase):
    pass

class AlertEventUpdate(BaseModel):
    is_false_alarm: Optional[bool] = None
    is_verified: Optional[bool] = None
    verified_by: Optional[str] = None
    notes: Optional[str] = None
    confidence: Optional[float] = None

class AlertEventResponse(AlertEventBase):
    id: int
    verified_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class NotificationStrategyBase(BaseModel):
    name: str
    geofence_id: int
    event_types: List[str]
    channels: List[str]
    min_interval: int = 60
    confidence_threshold: float = 0.8
    is_active: bool = True

class NotificationStrategyCreate(NotificationStrategyBase):
    pass

class NotificationStrategyResponse(NotificationStrategyBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class FalseAlarmFilterBase(BaseModel):
    name: str
    filter_type: str
    parameters: dict
    is_active: bool = True
    priority: int = 0

class FalseAlarmFilterCreate(FalseAlarmFilterBase):
    pass

class FalseAlarmFilterResponse(FalseAlarmFilterBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class TrajectoryReportBase(BaseModel):
    device_id: int
    geofence_id: Optional[int] = None
    start_time: datetime
    end_time: datetime

class TrajectoryReportCreate(TrajectoryReportBase):
    pass

class TrajectoryReportResponse(BaseModel):
    id: int
    report_id: str
    device_id: int
    geofence_id: Optional[int] = None
    start_time: datetime
    end_time: datetime
    total_points: int
    enter_count: int
    exit_count: int
    stay_duration: float
    generated_at: datetime
    generated_by: Optional[str] = None
    status: str

    class Config:
        from_attributes = True

class TrajectoryPlaybackRequest(BaseModel):
    device_id: int
    start_time: datetime
    end_time: datetime
    geofence_id: Optional[int] = None

class TraceRequest(BaseModel):
    device_id: int
    alert_id: int
    trace_type: str = "before"
    time_window: int = 300

class ManualCorrectionRequest(BaseModel):
    alert_id: int
    is_false_alarm: bool
    notes: str
    corrected_by: str

class ExportRequest(BaseModel):
    export_type: str
    device_id: Optional[int] = None
    geofence_id: Optional[int] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    format: str = "excel"