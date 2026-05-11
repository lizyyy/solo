from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List

class FilterBase(BaseModel):
    filter_id: str = Field(..., description="滤芯唯一标识")
    station_name: str = Field(..., description="净水站名称")
    filter_type: str = Field(..., description="滤芯类型")
    install_date: datetime = Field(..., description="安装日期")
    max_lifespan_days: int = Field(..., description="最大寿命天数")
    max_lifespan_liters: float = Field(..., description="最大寿命水量(升)")

class FilterCreate(FilterBase):
    pass

class FilterUpdate(BaseModel):
    station_name: Optional[str] = None
    filter_type: Optional[str] = None
    max_lifespan_days: Optional[int] = None
    max_lifespan_liters: Optional[float] = None
    status: Optional[str] = None

class FilterResponse(FilterBase):
    id: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class WaterQualityBase(BaseModel):
    filter_id: str
    record_date: datetime
    turbidity: Optional[float] = None
    ph: Optional[float] = None
    residual_chlorine: Optional[float] = None
    conductivity: Optional[float] = None
    total_dissolved_solids: Optional[float] = None
    color: Optional[float] = None
    odor: Optional[str] = None

class WaterQualityCreate(WaterQualityBase):
    pass

class WaterQualityResponse(WaterQualityBase):
    id: int
    is_valid: bool
    created_at: datetime

    class Config:
        from_attributes = True

class WaterVolumeBase(BaseModel):
    filter_id: str
    record_date: datetime
    daily_volume_liters: float
    cumulative_volume_liters: float
    peak_hour: Optional[str] = None
    avg_flow_rate: Optional[float] = None

class WaterVolumeCreate(WaterVolumeBase):
    pass

class WaterVolumeResponse(WaterVolumeBase):
    id: int
    is_valid: bool
    created_at: datetime

    class Config:
        from_attributes = True

class ComplaintBase(BaseModel):
    filter_id: str
    complaint_date: datetime
    complaint_type: str
    description: str
    severity: str
    reporter: Optional[str] = None

class ComplaintCreate(ComplaintBase):
    pass

class ComplaintUpdate(BaseModel):
    status: Optional[str] = None
    resolved_date: Optional[datetime] = None
    resolution: Optional[str] = None

class ComplaintResponse(ComplaintBase):
    id: int
    status: str
    resolved_date: Optional[datetime] = None
    resolution: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class PredictionBase(BaseModel):
    filter_id: str
    prediction_date: datetime
    predicted_remaining_days: int
    predicted_remaining_liters: float
    health_score: float
    risk_level: str
    recommendation: str
    explanation: str
    confidence: float

class PredictionCreate(PredictionBase):
    pass

class PredictionReview(BaseModel):
    reviewed_by: str
    review_status: str
    review_comment: Optional[str] = None

class PredictionResponse(PredictionBase):
    id: int
    reviewed_by: Optional[str] = None
    review_date: Optional[datetime] = None
    review_status: str
    review_comment: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class ReplacementReportBase(BaseModel):
    filter_id: str
    report_date: datetime
    old_filter_condition: str
    replacement_reason: str
    prediction_id: Optional[int] = None
    technician: Optional[str] = None
    notes: Optional[str] = None

class ReplacementReportCreate(ReplacementReportBase):
    pass

class ReplacementReportResponse(ReplacementReportBase):
    id: int
    status: str
    affected_next_prediction: bool
    created_at: datetime

    class Config:
        from_attributes = True

class ImportResult(BaseModel):
    total_records: int
    valid_records: int
    invalid_records: int
    warnings: List[str]
    errors: List[str]

class PredictionExplanation(BaseModel):
    factors: List[dict]
    overall_reasoning: str
    confidence_breakdown: dict

class BatchPredictionResult(BaseModel):
    filter_id: str
    prediction: PredictionResponse
    explanation: PredictionExplanation
