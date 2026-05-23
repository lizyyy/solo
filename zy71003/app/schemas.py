from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


class SlotBase(BaseModel):
    slot_number: str
    status: Optional[str] = "available"
    battery_id: Optional[str] = None


class SlotCreate(SlotBase):
    pass


class SlotUpdate(BaseModel):
    status: Optional[str] = None
    battery_id: Optional[str] = None


class Slot(SlotBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class BatteryBase(BaseModel):
    battery_id: str
    model: str
    manufacture_date: Optional[str] = None


class BatteryCreate(BatteryBase):
    pass


class Battery(BatteryBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class TemperatureSampleBase(BaseModel):
    battery_id: str
    temperature: float
    window_id: Optional[str] = None
    business_no: str
    is_anomaly: Optional[bool] = False


class TemperatureSampleCreate(TemperatureSampleBase):
    slot_number: str


class TemperatureSample(TemperatureSampleBase):
    id: int
    slot_id: int
    sample_time: datetime

    class Config:
        from_attributes = True


class DisableRecordBase(BaseModel):
    battery_id: str
    reason: str
    operator: str
    is_active: Optional[bool] = True


class DisableRecordCreate(DisableRecordBase):
    slot_number: str


class DisableRecord(DisableRecordBase):
    id: int
    slot_id: int
    disable_time: datetime

    class Config:
        from_attributes = True


class RecheckRecordBase(BaseModel):
    battery_id: str
    recheck_person: str
    conclusion: str
    remarks: Optional[str] = None
    business_no: str


class RecheckRecordCreate(RecheckRecordBase):
    slot_number: str


class RecheckRecord(RecheckRecordBase):
    id: int
    slot_id: int
    recheck_time: datetime

    class Config:
        from_attributes = True


class DisposalReportBase(BaseModel):
    battery_id: str
    slot_number: str
    anomaly_type: str
    disposal_method: str
    operator: str
    remarks: Optional[str] = None
    business_no: str


class DisposalReportCreate(DisposalReportBase):
    pass


class DisposalReport(DisposalReportBase):
    id: int
    report_no: str
    report_time: datetime

    class Config:
        from_attributes = True


class OperationLogBase(BaseModel):
    operation_type: str
    slot_number: Optional[str] = None
    battery_id: Optional[str] = None
    business_no: Optional[str] = None
    operator: Optional[str] = None
    details: str
    result: str
    error_code: Optional[str] = None


class OperationLogCreate(OperationLogBase):
    pass


class OperationLog(OperationLogBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class TemperatureWindowRequest(BaseModel):
    business_no: str
    slot_number: str
    battery_id: str
    temperatures: List[float]
    window_id: str
    threshold: Optional[float] = 50.0


class RecheckRequest(BaseModel):
    business_no: str
    slot_number: str
    battery_id: str
    recheck_person: str
    conclusion: str
    remarks: Optional[str] = None


class IdempotentResponse(BaseModel):
    business_no: str
    is_processed: bool
    message: str
    data: Optional[dict] = None


class ErrorResponse(BaseModel):
    error_code: str
    message: str
    details: Optional[str] = None
