from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Dict, Any
from app.models.enums import LedgerStatus, DataSourceType, UserRole, LossType, RecordStatus


class UserBase(BaseModel):
    username: str
    full_name: str
    role: UserRole


class UserCreate(UserBase):
    password: str


class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None


class DataSourceBase(BaseModel):
    source_type: DataSourceType
    source_no: str
    source_data: str
    file_url: Optional[str] = None


class DataSourceCreate(DataSourceBase):
    pass


class DataSourceResponse(DataSourceBase):
    id: int
    is_valid: bool
    validation_message: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class LossItemBase(BaseModel):
    item_no: str
    product_name: str
    weight: float
    loss_reason: str
    source_type: DataSourceType
    deduplication_key: str


class LossItemCreate(LossItemBase):
    pass


class LossItemResponse(LossItemBase):
    id: int
    record_status: RecordStatus
    validation_errors: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class StatusChangeHistoryBase(BaseModel):
    from_status: Optional[LedgerStatus]
    to_status: LedgerStatus
    change_reason: str


class StatusChangeHistoryResponse(StatusChangeHistoryBase):
    id: int
    operator_id: int
    operator_name: Optional[str] = None
    change_time: datetime
    ip_address: Optional[str] = None

    class Config:
        from_attributes = True


class LossLedgerBase(BaseModel):
    supplier_id: str
    supplier_name: str
    batch_no: str
    product_name: str
    total_weight: float
    loss_weight: float
    loss_type: LossType
    remark: Optional[str] = None


class LossLedgerCreate(LossLedgerBase):
    data_sources: List[DataSourceCreate] = Field(default_factory=list)
    loss_items: List[LossItemCreate] = Field(default_factory=list)


class LossLedgerUpdate(BaseModel):
    supplier_name: Optional[str] = None
    product_name: Optional[str] = None
    total_weight: Optional[float] = None
    loss_weight: Optional[float] = None
    loss_type: Optional[LossType] = None
    remark: Optional[str] = None
    data_sources: Optional[List[DataSourceCreate]] = None
    loss_items: Optional[List[LossItemCreate]] = None


class LossLedgerResponse(LossLedgerBase):
    id: int
    ledger_no: str
    status: LedgerStatus
    loss_rate: float
    current_version: int
    is_latest: bool
    parent_ledger_id: Optional[int]
    created_by: int
    created_at: datetime
    updated_at: Optional[datetime]
    data_sources: List[DataSourceResponse] = Field(default_factory=list)
    loss_items: List[LossItemResponse] = Field(default_factory=list)
    status_histories: List[StatusChangeHistoryResponse] = Field(default_factory=list)

    class Config:
        from_attributes = True


class LossLedgerSummary(BaseModel):
    id: int
    ledger_no: str
    supplier_name: str
    batch_no: str
    product_name: str
    total_weight: float
    loss_weight: float
    loss_rate: float
    loss_type: LossType
    status: LedgerStatus
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class StatusChangeRequest(BaseModel):
    change_reason: str = Field(..., min_length=1, description="状态变更原因")


class FailedRecordResponse(BaseModel):
    id: int
    batch_no: str
    source_type: DataSourceType
    error_type: str
    error_message: str
    retry_count: int
    created_at: datetime

    class Config:
        from_attributes = True


class LedgerListResponse(BaseModel):
    total: int
    items: List[LossLedgerSummary]


class RoleViewReport(BaseModel):
    role: UserRole
    total_ledgers: int
    pending_review: int
    total_loss_weight: float
    by_loss_type: Dict[str, float]
    by_supplier: Dict[str, float]


class DesensitizedExportItem(BaseModel):
    ledger_no: str
    supplier_name: str
    batch_no: str
    product_name: str
    total_weight: float
    loss_weight: float
    loss_rate: float
    loss_type: str
    status: str
    created_at: datetime
