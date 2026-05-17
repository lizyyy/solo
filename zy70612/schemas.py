from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from database import ConfirmationType, DiscrepancyStatus, VersionStatus


class StoreBase(BaseModel):
    store_code: str
    name: str
    region: Optional[str] = None
    manager_email: Optional[str] = None


class StoreCreate(StoreBase):
    pass


class Store(StoreBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class PriceTagItemBase(BaseModel):
    barcode: str
    product_name: str
    original_price: float
    promotion_price: float
    unit: Optional[str] = None


class PriceTagItemCreate(PriceTagItemBase):
    pass


class PriceTagItem(PriceTagItemBase):
    id: int
    version_id: int
    created_at: datetime

    class Config:
        orm_mode = True


class PriceTagVersionBase(BaseModel):
    version_code: str
    name: str
    description: Optional[str] = None
    promotion_start: datetime
    promotion_end: datetime
    created_by: str


class PriceTagVersionCreate(PriceTagVersionBase):
    pass


class PriceTagVersionUpdateStatus(BaseModel):
    status: VersionStatus


class PriceTagVersion(PriceTagVersionBase):
    id: int
    status: VersionStatus
    created_at: datetime
    updated_at: datetime
    closed_at: Optional[datetime] = None
    closed_by: Optional[str] = None
    items: List[PriceTagItem] = []

    class Config:
        orm_mode = True


class ConfirmationBase(BaseModel):
    store_id: int
    version_id: int
    confirmation_type: ConfirmationType
    confirmed_by: str
    photo_url: Optional[str] = None
    notes: Optional[str] = None


class ConfirmationCreate(ConfirmationBase):
    pass


class Confirmation(ConfirmationBase):
    id: int
    confirmed_at: datetime

    class Config:
        orm_mode = True


class DiscrepancyBase(BaseModel):
    version_id: int
    store_id: int
    discrepancy_type: str
    description: str
    original_input: Optional[str] = None
    detected_by: Optional[str] = None


class DiscrepancyCreate(DiscrepancyBase):
    pass


class DiscrepancyResolve(BaseModel):
    resolution: str
    resolved_by: str
    correct_action: str


class Discrepancy(DiscrepancyBase):
    id: int
    status: DiscrepancyStatus
    detected_at: datetime
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[str] = None
    resolution: Optional[str] = None
    correct_action: Optional[str] = None

    class Config:
        orm_mode = True


class StoreAssignment(BaseModel):
    store_ids: List[int]
    assigned_by: Optional[str] = None


class StoreConfirmationStatus(BaseModel):
    store_id: int
    store_name: str
    store_code: str
    start_confirmed: bool = False
    start_confirmed_at: Optional[datetime] = None
    start_confirmed_by: Optional[str] = None
    end_confirmed: bool = False
    end_confirmed_at: Optional[datetime] = None
    end_confirmed_by: Optional[str] = None
    has_discrepancies: bool = False


class VersionStatusSummary(BaseModel):
    version_id: int
    version_code: str
    name: str
    status: VersionStatus
    promotion_start: datetime
    promotion_end: datetime
    total_stores: int
    start_confirmed_count: int
    end_confirmed_count: int
    pending_stores: int
    has_discrepancies: bool
    store_statuses: List[StoreConfirmationStatus]


class VersionCloseRequest(BaseModel):
    closed_by: str
    notes: Optional[str] = None
