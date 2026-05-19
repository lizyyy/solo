from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional

class LabMeasurementBase(BaseModel):
    measurement_point: str
    l_value: float
    a_value: float
    b_value: float
    standard_l: Optional[float] = None
    standard_a: Optional[float] = None
    standard_b: Optional[float] = None

class LabMeasurementCreate(LabMeasurementBase):
    pass

class LabMeasurement(LabMeasurementBase):
    id: int
    quality_record_id: int
    delta_l: Optional[float] = None
    delta_a: Optional[float] = None
    delta_b: Optional[float] = None
    delta_e: Optional[float] = None
    is_anomaly: bool
    anomaly_reason: Optional[str] = None
    measured_at: datetime

    class Config:
        from_attributes = True

class ReworkRecordBase(BaseModel):
    rework_type: str
    rework_reason: str
    operator: Optional[str] = None
    result: str
    notes: Optional[str] = None

class ReworkRecordCreate(ReworkRecordBase):
    pass

class ReworkRecord(ReworkRecordBase):
    id: int
    quality_record_id: int
    rework_time: datetime

    class Config:
        from_attributes = True

class PaperBatchBase(BaseModel):
    batch_number: str
    paper_type: str
    supplier: Optional[str] = None
    production_date: Optional[datetime] = None
    notes: Optional[str] = None

class PaperBatchCreate(PaperBatchBase):
    pass

class PaperBatch(PaperBatchBase):
    id: int
    received_date: datetime
    created_at: datetime

    class Config:
        from_attributes = True

class QualityThresholdBase(BaseModel):
    product_type: str
    color_name: str
    l_min: float
    l_max: float
    a_min: float
    a_max: float
    b_min: float
    b_max: float
    delta_e_max: float = 2.0

class QualityThresholdCreate(QualityThresholdBase):
    pass

class QualityThreshold(QualityThresholdBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class QualityRecordBase(BaseModel):
    batch_number: str
    product_type: str
    paper_batch_id: Optional[int] = None
    inspector: str
    status: str
    notes: Optional[str] = None

class QualityRecordCreate(QualityRecordBase):
    lab_measurements: List[LabMeasurementCreate]
    rework_records: Optional[List[ReworkRecordCreate]] = None

class QualityRecordUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None

class QualityRecord(QualityRecordBase):
    id: int
    inspection_time: datetime
    overall_result: str
    reason: str
    anomaly_type: Optional[str] = None
    sample_retained: bool
    created_at: datetime
    lab_measurements: List[LabMeasurement]
    rework_records: List[ReworkRecord]

    class Config:
        from_attributes = True

class QualityRecordSummary(BaseModel):
    id: int
    batch_number: str
    product_type: str
    inspector: str
    inspection_time: datetime
    status: str
    overall_result: str
    anomaly_type: Optional[str]
    sample_retained: bool

    class Config:
        from_attributes = True

class PaginatedQualityRecords(BaseModel):
    total: int
    records: List[QualityRecord]

class ExportRequest(BaseModel):
    inspector: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    status: Optional[str] = None
    anomaly_type: Optional[str] = None
    batch_number: Optional[str] = None

class QualityCheckResult(BaseModel):
    passed: bool
    overall_result: str
    reason: str
    anomaly_type: Optional[str]
    sample_retained: bool
    measurement_results: List[dict]
