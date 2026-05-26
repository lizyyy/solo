from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime


class ChemicalInventoryBase(BaseModel):
    chemical_code: str
    name: str
    max_dosage_per_100m2: float
    min_interval_days: int
    wind_speed_limit: float
    hazard_level: str
    notes: Optional[str] = None


class ChemicalInventoryCreate(ChemicalInventoryBase):
    pass


class ChemicalInventoryResponse(ChemicalInventoryBase):
    id: int

    class Config:
        from_attributes = True


class WeatherRecordBase(BaseModel):
    weather_code: str
    record_date: str
    wind_speed: float
    temperature: float
    humidity: float
    rainfall: float
    weather_condition: str


class WeatherRecordCreate(WeatherRecordBase):
    pass


class WeatherRecordResponse(WeatherRecordBase):
    id: int

    class Config:
        from_attributes = True


class SprayRecordResult(BaseModel):
    record_index: int
    chemical_code: str
    area_code: str
    spray_date: str
    dosage: float
    operator: str
    weather_code: str
    status: str
    is_duplicate: bool
    rule_violations: List[str]
    suggestion: str
    raw_data: Dict[str, Any]


class SubmissionResponse(BaseModel):
    batch_no: str
    submitted_at: datetime
    summary: Dict[str, int]
    normal_items: List[SprayRecordResult]
    confirm_items: List[SprayRecordResult]
    failed_items: List[SprayRecordResult]
    duplicate_items: List[SprayRecordResult]


class BatchListResponse(BaseModel):
    batch_no: str
    submitted_at: datetime
    total_records: int
    normal_count: int
    confirm_count: int
    failed_count: int


class ReportResponse(BaseModel):
    batch_no: str
    generated_at: datetime
    report_content: str


class RecordDetailResponse(BaseModel):
    id: int
    batch_no: str
    chemical_code: str
    chemical_name: Optional[str]
    area_code: str
    spray_date: str
    dosage: float
    operator: str
    weather_code: str
    weather_info: Optional[Dict[str, Any]]
    status: str
    rule_violations: List[str]
    suggestion: str
    is_duplicate: bool
