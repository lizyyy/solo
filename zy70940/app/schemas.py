from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


class BatchBase(BaseModel):
    name: str
    remark: Optional[str] = None


class BatchCreate(BatchBase):
    created_by: str


class Batch(BatchBase):
    id: int
    batch_no: str
    status: str
    created_by: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class WaybillBase(BaseModel):
    waybill_no: str
    sender: Optional[str] = None
    receiver: Optional[str] = None
    origin: Optional[str] = None
    destination: Optional[str] = None
    weight: Optional[float] = None
    volume: Optional[float] = None
    expected_delivery: Optional[datetime] = None
    actual_delivery: Optional[datetime] = None


class WaybillCreate(WaybillBase):
    batch_id: int


class Waybill(WaybillBase):
    id: int
    batch_id: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class TrackingRecordBase(BaseModel):
    waybill_no: str
    timestamp: datetime
    node: str
    node_type: Optional[str] = None
    status: str
    operator: Optional[str] = None
    location: Optional[str] = None
    temperature: Optional[float] = None
    remark: Optional[str] = None


class TrackingRecordCreate(TrackingRecordBase):
    pass


class TrackingRecord(TrackingRecordBase):
    id: int
    waybill_id: int

    class Config:
        from_attributes = True


class PenaltyRuleBase(BaseModel):
    rule_code: str
    rule_name: str
    penalty_type: str
    penalty_ratio: float
    conditions: Optional[str] = None


class PenaltyRuleCreate(PenaltyRuleBase):
    pass


class PenaltyRule(PenaltyRuleBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PenaltyRecordBase(BaseModel):
    waybill_no: str
    exception_type: str
    exception_reason: str
    transfer_node: Optional[str] = None
    penalty_ratio: float = 0
    penalty_amount: float = 0
    is_weather_exempt: bool = False
    weather_reason: Optional[str] = None
    is_cross_transfer: bool = False
    cross_transfer_detail: Optional[str] = None
    is_duplicate: bool = False
    original_penalty_id: Optional[int] = None


class PenaltyRecordCreate(PenaltyRecordBase):
    batch_id: int
    rule_id: Optional[int] = None
    rule_code: Optional[str] = None
    rule_name: Optional[str] = None


class PenaltyRecord(PenaltyRecordBase):
    id: int
    batch_id: int
    waybill_id: int
    rule_id: Optional[int] = None
    rule_code: Optional[str] = None
    rule_name: Optional[str] = None
    status: str
    process_result: Optional[str] = None
    process_reason: Optional[str] = None
    processed_by: Optional[str] = None
    processed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProcessHistoryBase(BaseModel):
    penalty_record_id: int
    action: str
    old_status: Optional[str] = None
    new_status: Optional[str] = None
    reason: str
    operator: str


class ProcessHistoryCreate(ProcessHistoryBase):
    pass


class ProcessHistory(ProcessHistoryBase):
    id: int
    operated_at: datetime

    class Config:
        from_attributes = True


class ProcessRequest(BaseModel):
    record_ids: List[int]
    action: str
    reason: str
    operator: str


class PenaltyQuery(BaseModel):
    transfer_node: Optional[str] = None
    exception_type: Optional[str] = None
    exception_reason: Optional[str] = None
    min_penalty_ratio: Optional[float] = None
    max_penalty_ratio: Optional[float] = None
    status: Optional[str] = None
    batch_id: Optional[int] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class ImportResult(BaseModel):
    success: int
    failed: int
    errors: List[str] = []


class BatchDetail(Batch):
    waybill_count: int
    penalty_count: int
    pending_count: int
