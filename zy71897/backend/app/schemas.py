from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Dict, Any


class CompressorBase(BaseModel):
    equipment_no: str
    name: Optional[str] = None
    model: Optional[str] = None
    rated_power: Optional[float] = None
    rated_pressure: Optional[float] = None
    location: Optional[str] = None


class CompressorCreate(CompressorBase):
    pass


class Compressor(CompressorBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class EnergyRecordBase(BaseModel):
    compressor_id: int
    record_time: datetime
    power: Optional[float] = None
    current: Optional[float] = None
    voltage: Optional[float] = None
    pressure: Optional[float] = None
    flow_rate: Optional[float] = None
    temperature: Optional[float] = None
    running_hours: Optional[float] = None
    load_rate: Optional[float] = None


class EnergyRecordCreate(EnergyRecordBase):
    batch_id: Optional[str] = None
    source_file: Optional[str] = None


class EnergyRecordUpdate(BaseModel):
    power: Optional[float] = None
    current: Optional[float] = None
    voltage: Optional[float] = None
    pressure: Optional[float] = None
    flow_rate: Optional[float] = None
    temperature: Optional[float] = None
    running_hours: Optional[float] = None
    load_rate: Optional[float] = None
    edited_by: Optional[str] = None


class EnergyRecord(EnergyRecordBase):
    id: int
    is_manual_edited: bool
    edited_by: Optional[str] = None
    edited_at: Optional[datetime] = None
    batch_id: Optional[str] = None
    source_file: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class VibrationRecordBase(BaseModel):
    compressor_id: int
    record_time: datetime
    x_vibration: Optional[float] = None
    y_vibration: Optional[float] = None
    z_vibration: Optional[float] = None
    overall_vibration: Optional[float] = None
    frequency_spectrum: Optional[str] = None


class VibrationRecordCreate(VibrationRecordBase):
    batch_id: Optional[str] = None
    source_file: Optional[str] = None


class VibrationRecordUpdate(BaseModel):
    x_vibration: Optional[float] = None
    y_vibration: Optional[float] = None
    z_vibration: Optional[float] = None
    overall_vibration: Optional[float] = None
    frequency_spectrum: Optional[str] = None
    edited_by: Optional[str] = None


class VibrationRecord(VibrationRecordBase):
    id: int
    is_manual_edited: bool
    edited_by: Optional[str] = None
    edited_at: Optional[datetime] = None
    batch_id: Optional[str] = None
    source_file: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ThresholdConfigBase(BaseModel):
    parameter_name: str
    level: str
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    unit: Optional[str] = None
    description: Optional[str] = None


class ThresholdConfigCreate(ThresholdConfigBase):
    pass


class ThresholdConfig(ThresholdConfigBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AnomalyBase(BaseModel):
    record_time: datetime
    parameter: str
    actual_value: float
    threshold_level: str
    threshold_min: Optional[float] = None
    threshold_max: Optional[float] = None
    deviation: float
    severity: str
    description: str
    recommendation: str


class AnomalyCreate(AnomalyBase):
    diagnosis_id: int


class Anomaly(AnomalyBase):
    id: int
    diagnosis_id: int
    is_manual_override: bool
    override_note: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AnomalyOverride(BaseModel):
    is_manual_override: bool
    override_note: Optional[str] = None


class DiagnosisBase(BaseModel):
    compressor_id: int
    start_time: datetime
    end_time: datetime
    diagnosis_type: Optional[str] = "standard"


class DiagnosisCreate(DiagnosisBase):
    batch_id: Optional[str] = None


class DiagnosisReview(BaseModel):
    status: str
    review_comment: Optional[str] = None
    reviewed_by: Optional[str] = None


class DiagnosisCorrection(BaseModel):
    correction_note: str
    corrected_by: Optional[str] = None
    anomaly_overrides: Optional[Dict[int, AnomalyOverride]] = None


class Diagnosis(DiagnosisBase):
    id: int
    diagnosis_time: datetime
    energy_consumption: Optional[float] = None
    energy_efficiency: Optional[float] = None
    load_rate_avg: Optional[float] = None
    anomaly_score: Optional[float] = None
    abnormal_count: int = 0
    status: str
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    review_comment: Optional[str] = None
    is_manual_corrected: bool
    corrected_by: Optional[str] = None
    corrected_at: Optional[datetime] = None
    correction_note: Optional[str] = None
    batch_id: Optional[str] = None
    report_hash: Optional[str] = None
    created_at: datetime
    anomalies: List[Anomaly] = []

    class Config:
        from_attributes = True


class DiagnosisSummary(BaseModel):
    id: int
    compressor_id: int
    equipment_no: str
    start_time: datetime
    end_time: datetime
    energy_consumption: Optional[float] = None
    energy_efficiency: Optional[float] = None
    anomaly_score: Optional[float] = None
    abnormal_count: int
    status: str
    is_manual_corrected: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ImportResult(BaseModel):
    success: bool
    message: str
    total_records: int
    inserted_records: int
    updated_records: int
    skipped_records: int
    batch_id: str


class ExportRequest(BaseModel):
    compressor_id: Optional[int] = None
    start_time: datetime
    end_time: datetime
    export_type: str = "xlsx"
    filters: Optional[Dict[str, Any]] = None
    view_state: Optional[Dict[str, Any]] = None
    exported_by: Optional[str] = None


class ExportResult(BaseModel):
    success: bool
    message: str
    file_path: str
    file_name: str
    record_count: int
    report_hash: str


class DiagnosisResult(BaseModel):
    success: bool
    message: str
    diagnosis_id: int
    report_hash: str
    abnormal_count: int
    anomaly_score: float
