from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel

from app.models.calibration import CalibrationStatus


class CalibrationBase(BaseModel):
    instrument_id: int
    calibration_type: str
    scheduled_date: date
    calibration_agency: Optional[str] = None
    measurement_uncertainty: Optional[str] = None
    environmental_conditions: Optional[str] = None


class CalibrationCreate(CalibrationBase):
    pass


class CalibrationResult(BaseModel):
    calibration_date: date
    result_pass: bool
    certificate_number: Optional[str] = None
    remarks: Optional[str] = None


class CalibrationUpdate(BaseModel):
    calibration_type: Optional[str] = None
    scheduled_date: Optional[date] = None
    calibration_agency: Optional[str] = None
    certificate_number: Optional[str] = None
    measurement_uncertainty: Optional[str] = None
    environmental_conditions: Optional[str] = None
    remarks: Optional[str] = None


class CalibrationResponse(CalibrationBase):
    id: int
    status: CalibrationStatus
    calibration_date: Optional[date] = None
    certificate_number: Optional[str] = None
    result_pass: Optional[bool] = None
    remarks: Optional[str] = None
    calibrated_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
