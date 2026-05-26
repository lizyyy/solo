from datetime import datetime
from typing import Optional, List, Any

from pydantic import BaseModel, Field


# ---------- Batch ----------

class BatchCreate(BaseModel):
    batch_no: str
    source_type: str
    source_name: Optional[str] = None
    created_by: str
    remark: Optional[str] = None


class BatchResp(BaseModel):
    id: int
    batch_no: str
    source_type: str
    source_name: Optional[str] = None
    created_by: str
    status: str
    created_at: datetime
    updated_at: datetime
    remark: Optional[str] = None

    class Config:
        from_attributes = True


class BatchListResp(BaseModel):
    total: int
    items: List[BatchResp]


class BatchProcess(BaseModel):
    operator: str
    remark: Optional[str] = None


class BatchReturn(BaseModel):
    operator: str
    reason: str


# ---------- Record ----------

class RecordResp(BaseModel):
    id: int
    batch_id: int
    record_no: str
    patient_name: Optional[str] = None
    patient_id: Optional[str] = None
    unit_name: Optional[str] = None
    package_name: Optional[str] = None
    contract_id: Optional[str] = None
    item_code: Optional[str] = None
    item_name: Optional[str] = None
    item_type: Optional[str] = None
    unit_price: Optional[float] = None
    quantity: Optional[int] = None
    total_amount: Optional[float] = None
    voucher_code: Optional[str] = None
    coupon_stack: bool = False
    refund_flag: bool = False
    refund_amount: Optional[float] = None
    unit_limit_applied: bool = False
    unit_limit_amount: Optional[float] = None
    status: str
    reason: Optional[str] = None
    processed_by: Optional[str] = None
    processed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class RecordListResp(BaseModel):
    total: int
    items: List[RecordResp]


class RecordProcess(BaseModel):
    operator: str
    approved: bool
    reason: Optional[str] = None


class RecordReturn(BaseModel):
    operator: str
    reason: str


# ---------- Detail ----------

class RecordDetailResp(BaseModel):
    id: int
    record_id: int
    field_key: str
    field_value: Optional[str] = None
    extra: Optional[Any] = None

    class Config:
        from_attributes = True


# ---------- Audit Log ----------

class AuditLogResp(BaseModel):
    id: int
    batch_id: Optional[int] = None
    record_id: Optional[int] = None
    action: str
    detail: Optional[str] = None
    operator: str
    operated_at: datetime

    class Config:
        from_attributes = True


class AuditLogListResp(BaseModel):
    total: int
    items: List[AuditLogResp]


# ---------- Settlement ----------

class SettlementCreate(BaseModel):
    settlement_no: str
    batch_id: int
    contract_id: Optional[str] = None
    unit_name: Optional[str] = None
    total_amount: float
    record_ids: List[int]
    created_by: str


class SettlementConfirm(BaseModel):
    operator: str


class SettlementItemResp(BaseModel):
    id: int
    settlement_id: int
    record_id: int
    amount: float
    record: Optional[RecordResp] = None

    class Config:
        from_attributes = True


class SettlementResp(BaseModel):
    id: int
    settlement_no: str
    batch_id: int
    contract_id: Optional[str] = None
    unit_name: Optional[str] = None
    total_amount: float
    status: str
    created_by: str
    created_at: datetime
    confirmed_by: Optional[str] = None
    confirmed_at: Optional[datetime] = None
    items: List[SettlementItemResp] = []

    class Config:
        from_attributes = True


class SettlementListResp(BaseModel):
    total: int
    items: List[SettlementResp]


class SettlementTraceResp(BaseModel):
    settlement: SettlementResp
    trace_logs: List[AuditLogResp]
    source_batch: Optional[BatchResp] = None
