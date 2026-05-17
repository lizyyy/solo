from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from models import SettlementStatus


class FarmerBase(BaseModel):
    name: str
    phone: Optional[str] = None
    id_card: Optional[str] = None
    village: Optional[str] = None


class FarmerCreate(FarmerBase):
    pass


class Farmer(FarmerBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PlotBase(BaseModel):
    farmer_id: int
    plot_code: str
    plot_name: Optional[str] = None
    location: Optional[str] = None
    standard_area: float
    land_type: Optional[str] = None


class PlotCreate(PlotBase):
    pass


class Plot(PlotBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ProjectBase(BaseModel):
    project_code: str
    project_name: str
    unit_price: float
    unit: str = "mu"
    description: Optional[str] = None
    is_active: bool = True


class ProjectCreate(ProjectBase):
    pass


class Project(ProjectBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class GPSRecordBase(BaseModel):
    plot_id: int
    project_id: int
    gps_area: float
    operation_date: Optional[datetime] = None
    device_id: Optional[str] = None
    operator: Optional[str] = None
    coordinates: Optional[str] = None
    batch_no: Optional[str] = None


class GPSRecordCreate(GPSRecordBase):
    pass


class GPSRecord(GPSRecordBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class ConfirmationBase(BaseModel):
    plot_id: int
    farmer_id: int
    project_id: int
    confirmed_area: float
    confirmed_by: str
    notes: Optional[str] = None
    signature_image: Optional[str] = None
    batch_no: Optional[str] = None


class ConfirmationCreate(ConfirmationBase):
    pass


class Confirmation(ConfirmationBase):
    id: int
    confirmed_at: datetime

    class Config:
        from_attributes = True


class SettlementItemBase(BaseModel):
    plot_id: int
    project_id: int
    gps_record_id: int
    gps_area: float
    confirmed_area: Optional[float] = None
    final_area: float
    unit_price: float
    amount: float
    is_duplicate: bool = False
    duplicate_with: Optional[int] = None
    area_diff: float = 0
    area_diff_ratio: float = 0
    notes: Optional[str] = None


class SettlementItemCreate(SettlementItemBase):
    pass


class SettlementItem(SettlementItemBase):
    id: int
    settlement_id: int

    class Config:
        from_attributes = True


class ExceptionRecordBase(BaseModel):
    exception_type: str
    original_input: str
    handled_by: Optional[str] = None
    handling_result: Optional[str] = None
    handling_notes: Optional[str] = None
    status: str = "pending"


class ExceptionRecordCreate(ExceptionRecordBase):
    pass


class ExceptionRecord(ExceptionRecordBase):
    id: int
    settlement_id: int
    created_at: datetime
    handled_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SettlementBase(BaseModel):
    farmer_id: int
    notes: Optional[str] = None


class SettlementCreate(SettlementBase):
    gps_batch_no: Optional[str] = None
    confirmation_batch_no: Optional[str] = None


class SettlementUpdate(BaseModel):
    status: Optional[SettlementStatus] = None
    processed_by: Optional[str] = None
    notes: Optional[str] = None


class Settlement(SettlementBase):
    id: int
    settlement_no: str
    status: SettlementStatus
    total_gps_area: float
    total_confirmed_area: float
    total_final_area: float
    total_amount: float
    processed_by: Optional[str] = None
    processed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    items: List[SettlementItem] = []
    exception_records: List[ExceptionRecord] = []

    class Config:
        from_attributes = True


class SettlementList(BaseModel):
    total: int
    items: List[Settlement]


class ManualCorrectionItem(BaseModel):
    settlement_item_id: int
    final_area: float
    notes: Optional[str] = None


class ManualCorrectionRequest(BaseModel):
    settlement_id: int
    processed_by: str
    corrections: List[ManualCorrectionItem]
    notes: Optional[str] = None


class ExceptionHandleRequest(BaseModel):
    exception_record_id: int
    handled_by: str
    handling_result: str
    handling_notes: Optional[str] = None
