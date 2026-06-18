from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class DutyStaffOut(BaseModel):
    staff_id: str
    name: str
    role: str
    phone: str = ""
    contact_hint: str = ""

    class Config:
        from_attributes = True


class SensorOut(BaseModel):
    sensor_id: str
    name: str
    location: str
    status: str
    drift_threshold: float
    last_calibration: Optional[datetime] = None
    responsible_person_id: str = ""
    data_source_url: str = ""

    class Config:
        from_attributes = True


class FormulaStepOut(BaseModel):
    step_index: int
    description: str
    formula: str
    unit: str
    input_value: float
    output_value: float
    boundary_check: Optional[str] = None
    note: str = ""

    class Config:
        from_attributes = True


class CalculationTrailOut(BaseModel):
    final_result: float
    final_unit: str
    formula_steps: list[FormulaStepOut]
    boundary_values: dict[str, list[float]]
    warning_flags: list[str]

    class Config:
        from_attributes = True


class LabResultOut(BaseModel):
    lab_result_id: str
    sample_id: str
    sample_time: datetime
    report_time: datetime
    experiment_time: datetime
    result_value: float
    result_unit: str
    test_item: str
    attachment_arrived: bool
    attachment_arrival_time: Optional[datetime] = None
    remark: str = ""

    class Config:
        from_attributes = True


class SamplingRecordOut(BaseModel):
    sample_id: str
    station_id: str
    station_name: str
    sampling_time: datetime
    location_lng: float
    location_lat: float
    sensor_id: str
    sensor_value: float
    operator_id: str
    remark: str = ""

    class Config:
        from_attributes = True


class SpatialAnnotationOut(BaseModel):
    annotation_id: str
    sample_id: str
    station_id: str
    location_lng: float
    location_lat: float
    zone_level: str
    zone_name: str
    calculation_trail: CalculationTrailOut
    status: str
    alerts: list[str]
    handler_hint: str
    data_sources: list[str]
    created_at: datetime
    created_by: str

    class Config:
        from_attributes = True


class PendingRecordOut(BaseModel):
    annotation_id: str
    sample_id: str
    station_name: str
    status: str
    summary: str
    created_at: datetime
    action_needed: str
    contact_person: str = ""
    check_first_source: str = ""

    class Config:
        from_attributes = True


class RemarkUpdateIn(BaseModel):
    remark: str = Field(..., min_length=1, max_length=500)
    operator_id: str = "S001"


class RunMainFlowOut(BaseModel):
    total: int
    normal: int
    time_mismatch: int
    late_attachment: int
    sensor_drift: int
    duplicate: int
    annotations: list[SpatialAnnotationOut]


class ApiInfoOut(BaseModel):
    name: str
    version: str
    operator: str
    available_commands: list[str]
    endpoints: list[dict[str, str]]
