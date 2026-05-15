from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel
from .models import ReconciliationStatus, DiscrepancyType, ActionType


class ChannelTransactionBase(BaseModel):
    transaction_id: str
    channel: str
    amount: float
    currency: str = "CNY"
    transaction_time: datetime
    status: str
    order_no: str
    raw_data: Optional[str] = None


class ChannelTransactionCreate(ChannelTransactionBase):
    pass


class ChannelTransaction(ChannelTransactionBase):
    id: int
    batch_id: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


class InternalOrderBase(BaseModel):
    order_no: str
    amount: float
    currency: str = "CNY"
    status: str
    payment_method: str
    created_time: datetime
    paid_time: Optional[datetime] = None
    raw_data: Optional[str] = None


class InternalOrderCreate(InternalOrderBase):
    pass


class InternalOrder(InternalOrderBase):
    id: int
    batch_id: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


class RefundRecordBase(BaseModel):
    refund_id: str
    order_no: str
    amount: float
    status: str
    refund_time: datetime
    channel_refund_id: Optional[str] = None
    raw_data: Optional[str] = None


class RefundRecordCreate(RefundRecordBase):
    pass


class RefundRecord(RefundRecordBase):
    id: int
    batch_id: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


class ReconciliationBatchBase(BaseModel):
    batch_no: str
    channel: str
    reconciliation_date: datetime


class ReconciliationBatchCreate(ReconciliationBatchBase):
    pass


class ReconciliationBatch(ReconciliationBatchBase):
    id: int
    status: ReconciliationStatus
    total_channel_count: int
    total_channel_amount: float
    total_internal_count: int
    total_internal_amount: float
    matched_count: int
    discrepancy_count: int
    error_message: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ReconciliationBatchDetail(ReconciliationBatch):
    channel_transactions: List[ChannelTransaction] = []
    internal_orders: List[InternalOrder] = []
    discrepancies: List = []
    history: List = []


class DiscrepancyBase(BaseModel):
    discrepancy_type: DiscrepancyType
    description: str
    expected_amount: Optional[float] = None
    actual_amount: Optional[float] = None


class DiscrepancyCreate(DiscrepancyBase):
    batch_id: int
    channel_transaction_id: Optional[int] = None
    internal_order_id: Optional[int] = None


class Discrepancy(DiscrepancyBase):
    id: int
    batch_id: int
    channel_transaction_id: Optional[int]
    internal_order_id: Optional[int]
    status: ReconciliationStatus
    resolved_note: Optional[str]
    resolved_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class DiscrepancyResolve(BaseModel):
    resolved_note: str
    operator: str = "manual"


class ProcessingHistoryBase(BaseModel):
    action_type: ActionType
    status: str
    operator: str = "system"
    details: str
    error_message: Optional[str] = None


class ProcessingHistoryCreate(ProcessingHistoryBase):
    batch_id: Optional[int] = None
    discrepancy_id: Optional[int] = None


class ProcessingHistory(ProcessingHistoryBase):
    id: int
    batch_id: Optional[int]
    discrepancy_id: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


class BatchStatistics(BaseModel):
    total_batches: int
    pending_batches: int
    processing_batches: int
    matched_batches: int
    discrepancy_batches: int
    resolved_batches: int
    failed_batches: int


class DiscrepancyStatistics(BaseModel):
    total_discrepancies: int
    by_type: dict


class ImportResult(BaseModel):
    success: bool
    batch_no: str
    channel_count: int
    internal_count: int
    message: str
