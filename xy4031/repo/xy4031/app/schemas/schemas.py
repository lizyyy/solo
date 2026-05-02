from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class ReleaseStatus(str, Enum):
    APPROVED = "可放行"
    NEEDS_REVIEW = "需复检"
    FORBIDDEN = "禁止使用"


class BatteryPackBase(BaseModel):
    battery_id: str = Field(..., description="电池编号，唯一标识")
    name: Optional[str] = Field(None, description="电池名称")
    purchase_date: Optional[datetime] = Field(None, description="购买日期")
    initial_cycles: int = Field(0, description="初始循环次数")
    cell_count: int = Field(6, description="电芯数量")
    capacity_mah: Optional[int] = Field(None, description="容量(mAh)")
    status: str = Field("active", description="状态: active/inactive/sealed")


class BatteryPackCreate(BatteryPackBase):
    pass


class BatteryPackUpdate(BaseModel):
    name: Optional[str] = None
    purchase_date: Optional[datetime] = None
    cell_count: Optional[int] = None
    capacity_mah: Optional[int] = None
    status: Optional[str] = None


class BatteryPackResponse(BatteryPackBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class ChargeRecordBase(BaseModel):
    battery_id: str
    charge_start_time: Optional[datetime] = None
    charge_end_time: Optional[datetime] = None
    start_voltage: Optional[float] = None
    end_voltage: Optional[float] = None
    charge_current: Optional[float] = None
    capacity_charged_mah: Optional[float] = None
    cycle_count: Optional[int] = None
    charger_id: Optional[str] = None


class ChargeRecordCreate(ChargeRecordBase):
    pass


class ChargeRecordResponse(ChargeRecordBase):
    id: int
    import_source: Optional[str]
    import_hash: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


class FlightRecordBase(BaseModel):
    battery_id: str
    flight_date: Optional[datetime] = None
    flight_duration_min: Optional[float] = None
    start_voltage: Optional[float] = None
    end_voltage: Optional[float] = None
    min_voltage: Optional[float] = None
    avg_current: Optional[float] = None
    max_current: Optional[float] = None
    temperature_c: Optional[float] = None
    cycle_count: Optional[int] = None
    has_low_voltage_alert: bool = False
    low_voltage_alert_time: Optional[datetime] = None
    low_voltage_alert_value: Optional[float] = None
    drone_id: Optional[str] = None
    mission_name: Optional[str] = None


class FlightRecordCreate(FlightRecordBase):
    pass


class FlightRecordResponse(FlightRecordBase):
    id: int
    import_source: Optional[str]
    import_hash: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


class CellVoltageReadingBase(BaseModel):
    battery_id: str
    reading_time: Optional[datetime] = None
    cell_1_voltage: Optional[float] = None
    cell_2_voltage: Optional[float] = None
    cell_3_voltage: Optional[float] = None
    cell_4_voltage: Optional[float] = None
    cell_5_voltage: Optional[float] = None
    cell_6_voltage: Optional[float] = None
    cell_7_voltage: Optional[float] = None
    cell_8_voltage: Optional[float] = None
    cell_9_voltage: Optional[float] = None
    cell_10_voltage: Optional[float] = None
    cell_11_voltage: Optional[float] = None
    cell_12_voltage: Optional[float] = None
    total_voltage: Optional[float] = None
    max_cell_voltage: Optional[float] = None
    min_cell_voltage: Optional[float] = None
    voltage_diff: Optional[float] = None
    reading_source: Optional[str] = None


class CellVoltageReadingCreate(CellVoltageReadingBase):
    pass


class CellVoltageReadingResponse(CellVoltageReadingBase):
    id: int
    import_hash: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


class MaintenanceNoteBase(BaseModel):
    battery_id: str
    note_date: Optional[datetime] = None
    note_type: str = Field(..., description="类型: maintenance/repair/seal/other")
    title: str
    content: str
    author: Optional[str] = None
    is_sealed: bool = False


class MaintenanceNoteCreate(MaintenanceNoteBase):
    pass


class MaintenanceNoteResponse(MaintenanceNoteBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class QuarantineRecordResponse(BaseModel):
    id: int
    import_session_id: Optional[str]
    source_type: Optional[str]
    source_file: Optional[str]
    row_number: Optional[int]
    raw_data: Optional[str]
    error_type: Optional[str]
    error_message: Optional[str]
    battery_id_extracted: Optional[str]
    timestamp_extracted: Optional[datetime]
    is_resolved: bool
    resolution_note: Optional[str]
    created_at: datetime
    resolved_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class SystemConfigBase(BaseModel):
    config_key: str
    config_value: str
    config_type: str = "string"
    description: Optional[str] = None


class SystemConfigCreate(SystemConfigBase):
    pass


class SystemConfigResponse(SystemConfigBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class RuleHit(BaseModel):
    rule_name: str
    rule_code: str
    severity: str
    message: str
    evidence: Dict[str, Any]


class ReleaseCheckResult(BaseModel):
    battery_id: str
    status: ReleaseStatus
    rule_hits: List[RuleHit] = []
    current_cycles: Optional[int] = None
    last_flight_date: Optional[datetime] = None
    last_charge_date: Optional[datetime] = None
    storage_days: Optional[int] = None
    has_low_voltage_alert_since_last_check: bool = False


class ReleaseCheckRequest(BaseModel):
    mission_date: datetime
    min_temperature: float = Field(-10.0, description="最低环境温度(°C)")
    expected_flights: int = Field(1, description="预计飞行架次")
    battery_ids: List[str] = Field(..., description="候选电池编号列表")


class ReleaseCheckResponse(BaseModel):
    request_time: datetime
    mission_date: datetime
    results: List[ReleaseCheckResult]


class ImportResult(BaseModel):
    success: bool
    message: str
    total_rows: int = 0
    imported_rows: int = 0
    duplicate_rows: int = 0
    quarantined_rows: int = 0
    import_session_id: Optional[str] = None
    quarantined_ids: List[int] = []


class HistoryQueryParams(BaseModel):
    battery_id: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    record_type: Optional[str] = None
    page: int = 1
    page_size: int = 50


class ExportRequest(BaseModel):
    battery_id: str
    format: str = Field("markdown", description="导出格式: markdown/csv")
    include_charge: bool = True
    include_flight: bool = True
    include_voltage: bool = True
    include_maintenance: bool = True
