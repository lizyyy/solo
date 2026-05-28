from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field, field_validator, ValidationError
from enum import Enum

class DataSourceType(str, Enum):
    RESERVATIONS = "reservations"
    WEATHER = "weather"
    EVENTS = "events"
    HISTORICAL = "historical"
    CAPACITY = "capacity"
    FORECAST_REPORT = "forecast_report"

class ProcessingStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    SUCCESS = "success"
    WARNING = "warning"
    ERROR = "error"

class ReservationStatus(str, Enum):
    CONFIRMED = "confirmed"
    PENDING = "pending"
    CANCELLED = "cancelled"

class WeatherCondition(str, Enum):
    SUNNY = "sunny"
    CLOUDY = "cloudy"
    RAINY = "rainy"
    STORMY = "stormy"

class BaseDataRecord(BaseModel):
    raw_data: Dict[str, Any] = Field(default_factory=dict, description="原始数据保留")
    manual_notes: Optional[str] = Field(None, description="手工备注")
    import_timestamp: datetime = Field(default_factory=datetime.now)
    data_source: DataSourceType

class ReservationRecord(BaseDataRecord):
    booking_id: str
    date: str
    hour: int
    people_count: int
    status: ReservationStatus
    visitor_type: Optional[str] = None
    group_id: Optional[str] = None
    
    @field_validator('hour')
    def validate_hour(cls, v):
        if not 0 <= v <= 23:
            raise ValueError(f"小时必须在0-23范围内: {v}")
        return v
    
    @field_validator('people_count')
    def validate_people_count(cls, v):
        if v < 0:
            raise ValueError(f"人数不能为负数: {v}")
        return v

class WeatherRecord(BaseDataRecord):
    date: str
    hour: int
    temperature: Optional[float] = None
    rain_probability: Optional[float] = None
    weather_condition: Optional[WeatherCondition] = None
    wind_speed: Optional[float] = None
    
    @field_validator('hour')
    def validate_hour(cls, v):
        if not 0 <= v <= 23:
            raise ValueError(f"小时必须在0-23范围内: {v}")
        return v
    
    @field_validator('rain_probability')
    def validate_rain_prob(cls, v):
        if v is not None and not 0 <= v <= 1:
            raise ValueError(f"降雨概率必须在0-1范围内: {v}")
        return v

class EventRecord(BaseDataRecord):
    event_id: str
    date: str
    hour: int
    event_type: str
    expected_attendance: int
    event_name: Optional[str] = None
    is_vip: bool = False
    location: Optional[str] = None

class HistoricalRecord(BaseDataRecord):
    date: str
    hour: int
    actual_visitors: int
    exhibition_id: Optional[str] = None
    is_weekend: Optional[bool] = None
    is_holiday: Optional[bool] = None

class CapacityRecord(BaseDataRecord):
    area_id: str
    area_name: str
    max_capacity: int
    current_count: Optional[int] = None
    exhibition_name: Optional[str] = None

class ForecastResult(BaseModel):
    date: str
    hour: int
    predicted_visitors: float
    lower_bound: float
    upper_bound: float
    confidence_level: float
    scenario: str = "base"
    model_version: str = "v1.0"
    timestamp: datetime = Field(default_factory=datetime.now)

class AnomalyRecord(BaseModel):
    anomaly_type: str
    severity: str
    message: str
    timestamp: datetime = Field(default_factory=datetime.now)
    related_data: Dict[str, Any] = Field(default_factory=dict)
    suggestion: str

class BatchJob(BaseModel):
    job_id: str
    status: ProcessingStatus = ProcessingStatus.PENDING
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    data_sources: List[DataSourceType] = Field(default_factory=list)
    anomalies: List[AnomalyRecord] = Field(default_factory=list)
    results_summary: Dict[str, Any] = Field(default_factory=dict)
    error_message: Optional[str] = None
