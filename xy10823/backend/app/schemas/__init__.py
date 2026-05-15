from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from backend.app.models import (
    WarehouseAccountStatus, LogisticsChannelStatus, LabelTemplateStatus,
    PrintBatchStatus, LabelRecordStatus, ExceptionType, ExceptionStatus
)


class WarehouseAccountBase(BaseModel):
    code: str
    name: str
    status: Optional[WarehouseAccountStatus] = WarehouseAccountStatus.ACTIVE
    config: Optional[str] = None


class WarehouseAccountCreate(WarehouseAccountBase):
    pass


class WarehouseAccount(WarehouseAccountBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True


class LogisticsChannelBase(BaseModel):
    code: str
    name: str
    carrier: str
    status: Optional[LogisticsChannelStatus] = LogisticsChannelStatus.ENABLED
    api_config: Optional[str] = None


class LogisticsChannelCreate(LogisticsChannelBase):
    pass


class LogisticsChannel(LogisticsChannelBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True


class LabelTemplateBase(BaseModel):
    code: str
    name: str
    channel_id: int
    status: Optional[LabelTemplateStatus] = LabelTemplateStatus.ACTIVE
    template_content: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None


class LabelTemplateCreate(LabelTemplateBase):
    pass


class LabelTemplate(LabelTemplateBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True


class LabelRecordItem(BaseModel):
    order_no: str
    receiver_name: str
    receiver_phone: str
    receiver_address: str
    sender_info: Optional[str] = None
    goods_info: Optional[str] = None
    weight: Optional[str] = None


class PrintBatchCreate(BaseModel):
    warehouse_code: str
    channel_code: str
    template_code: Optional[str] = None
    records: List[LabelRecordItem]


class PrintBatchBase(BaseModel):
    id: int
    batch_no: str
    warehouse_id: int
    channel_id: int
    template_id: Optional[int] = None
    status: PrintBatchStatus
    total_count: int
    success_count: int
    failed_count: int
    created_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        orm_mode = True


class StatusHistoryBase(BaseModel):
    id: int
    record_id: int
    from_status: Optional[str] = None
    to_status: str
    reason: Optional[str] = None
    operator: Optional[str] = None
    created_at: datetime

    class Config:
        orm_mode = True


class ExceptionRecordBase(BaseModel):
    id: int
    record_id: int
    exception_type: ExceptionType
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    error_detail: Optional[str] = None
    status: ExceptionStatus
    resolution: Optional[str] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        orm_mode = True


class ReprintRecordBase(BaseModel):
    id: int
    record_id: int
    reprint_count: int
    reprint_reason: Optional[str] = None
    operator: Optional[str] = None
    created_at: datetime

    class Config:
        orm_mode = True


class LabelRecordBase(BaseModel):
    id: int
    record_no: str
    batch_id: int
    order_no: Optional[str] = None
    tracking_no: Optional[str] = None
    status: LabelRecordStatus
    receiver_name: Optional[str] = None
    receiver_phone: Optional[str] = None
    receiver_address: Optional[str] = None
    sender_info: Optional[str] = None
    goods_info: Optional[str] = None
    weight: Optional[str] = None
    label_url: Optional[str] = None
    status_reason: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True


class LabelRecordDetail(LabelRecordBase):
    status_history: List[StatusHistoryBase]
    exceptions: List[ExceptionRecordBase]
    reprints: List[ReprintRecordBase]


class PrintBatchDetail(PrintBatchBase):
    records: List[LabelRecordBase]


class StatusUpdateRequest(BaseModel):
    new_status: LabelRecordStatus
    reason: Optional[str] = None
    operator: Optional[str] = "system"


class ExceptionResolveRequest(BaseModel):
    resolution: str
    operator: Optional[str] = "system"


class ReprintRequest(BaseModel):
    reason: str
    operator: Optional[str] = "system"


class ExportFilter(BaseModel):
    batch_no: Optional[str] = None
    status: Optional[LabelRecordStatus] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
