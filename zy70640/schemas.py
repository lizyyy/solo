from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List


class StationBase(BaseModel):
    name: str
    km_marker: float
    type: str
    max_capacity: int


class StationCreate(StationBase):
    pass


class Station(StationBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SupplyCategoryBase(BaseModel):
    name: str
    unit: str
    per_person_consumption: float
    description: Optional[str] = None


class SupplyCategoryCreate(SupplyCategoryBase):
    pass


class SupplyCategory(SupplyCategoryBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class RaceConfigBase(BaseModel):
    race_name: str
    total_runners: int
    expected_dropout_rate: float = 0.05
    backup_ratio_water: float = 0.2
    backup_ratio_salt: float = 0.3
    backup_ratio_gel: float = 0.25


class RaceConfigCreate(RaceConfigBase):
    pass


class RaceConfig(RaceConfigBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SupplyRecordBase(BaseModel):
    station_id: int
    category_id: int
    allocated_quantity: int


class SupplyRecordCreate(SupplyRecordBase):
    pass


class SupplyRecordUpdate(BaseModel):
    allocated_quantity: Optional[int] = None
    backup_quantity: Optional[int] = None
    status: Optional[str] = None


class SupplyRecord(SupplyRecordBase):
    id: int
    backup_quantity: int
    total_required: int
    status: str
    created_at: datetime
    updated_at: datetime
    station: Station
    category: SupplyCategory

    class Config:
        from_attributes = True


class GapRecordBase(BaseModel):
    station_id: int
    category_id: int
    supply_record_id: int
    gap_quantity: int


class GapRecordCreate(GapRecordBase):
    pass


class GapRecordUpdate(BaseModel):
    status: Optional[str] = None
    handler: Optional[str] = None
    conclusion: Optional[str] = None
    suggestion: Optional[str] = None


class GapRecord(GapRecordBase):
    id: int
    gap_level: str
    priority: int
    status: str
    suggestion: Optional[str] = None
    handler: Optional[str] = None
    conclusion: Optional[str] = None
    raw_input: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TransferLogBase(BaseModel):
    gap_record_id: int
    from_station_id: int
    to_station_id: int
    category_id: int
    transfer_quantity: int
    operator: str
    notes: Optional[str] = None


class TransferLogCreate(TransferLogBase):
    pass


class TransferLog(TransferLogBase):
    id: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class ExceptionLogBase(BaseModel):
    operation_type: str
    raw_input: str
    handler: str
    conclusion: str
    error_message: Optional[str] = None


class ExceptionLogCreate(ExceptionLogBase):
    pass


class ExceptionLog(ExceptionLogBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class CSVImportResponse(BaseModel):
    success: bool
    message: str
    records_imported: int
    errors: List[str] = []


class CalculationResponse(BaseModel):
    success: bool
    message: str
    total_gaps: int
    gap_details: List[dict] = []


class TransferSuggestion(BaseModel):
    from_station: str
    to_station: str
    category: str
    suggested_quantity: int
    priority: int
    reason: str


class AllocationReport(BaseModel):
    race_name: str
    total_runners: int
    generated_at: datetime
    stations_summary: List[dict]
    gap_summary: List[dict]
    transfer_suggestions: List[TransferSuggestion]
