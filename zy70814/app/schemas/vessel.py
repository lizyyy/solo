from datetime import datetime
from typing import Optional
from app.schemas.common import BaseSchema


class VesselScheduleBase(BaseSchema):
    vessel_name: str
    vessel_imo: Optional[str] = None
    voyage_number: Optional[str] = None
    draft: float
    deadweight: Optional[float] = None
    eta: datetime
    etd: Optional[datetime] = None
    etb: Optional[datetime] = None
    ets: Optional[datetime] = None
    service_type: Optional[str] = None
    terminal: Optional[str] = None
    berth_number: Optional[str] = None
    cargo_type: Optional[str] = None
    cargo_quantity: Optional[float] = None
    is_cut_in: bool = False
    cut_in_reason: Optional[str] = None
    notes: Optional[str] = None


class VesselScheduleCreate(VesselScheduleBase):
    source_file: Optional[str] = None
    batch_id: Optional[str] = None


class VesselScheduleUpdate(BaseSchema):
    draft: Optional[float] = None
    eta: Optional[datetime] = None
    etd: Optional[datetime] = None
    berth_number: Optional[str] = None
    is_cut_in: Optional[bool] = None
    cut_in_reason: Optional[str] = None
    notes: Optional[str] = None


class VesselScheduleResponse(VesselScheduleBase):
    id: int
    status: str
    source_file: Optional[str] = None
    batch_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
