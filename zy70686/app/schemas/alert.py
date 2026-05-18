from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class AlertReportBase(BaseModel):
    store_id: int = Field(..., gt=0)
    material_id: int = Field(..., gt=0)
    alert_type: str = Field(..., min_length=1, max_length=50)
    alert_level: Optional[str] = "warning"
    current_stock: float = Field(..., ge=0)
    forecast_consumption: float = Field(..., ge=0)
    estimated_runout_days: Optional[float] = None
    remarks: Optional[str] = None


class AlertReportCreate(AlertReportBase):
    pass


class AlertReportHandle(BaseModel):
    status: str = Field(..., min_length=1)
    handled_by: str = Field(..., min_length=1)
    remarks: Optional[str] = None


class AlertMergeRequest(BaseModel):
    alert_ids: List[int] = Field(..., min_length=2)
    merged_alert_type: str
    handled_by: str


class AlertReportResponse(AlertReportBase):
    id: int
    alert_no: str
    status: str
    merged_from: Optional[str] = None
    handled_by: Optional[str] = None
    handled_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True
