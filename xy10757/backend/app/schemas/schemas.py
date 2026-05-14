from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List

class PointBatchBase(BaseModel):
    batch_no: str
    member_id: str
    points: int
    source: Optional[str] = None
    expire_date: Optional[datetime] = None
    remark: Optional[str] = None

class PointBatchCreate(PointBatchBase):
    pass

class PointBatchResponse(PointBatchBase):
    id: int
    status: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class FrozenBalanceBase(BaseModel):
    member_id: str
    batch_id: int
    frozen_points: int
    reason: Optional[str] = None
    operator: Optional[str] = None

class FrozenBalanceCreate(FrozenBalanceBase):
    pass

class FrozenBalanceResponse(FrozenBalanceBase):
    id: int
    status: str
    created_at: datetime
    unfrozen_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class PointTransactionBase(BaseModel):
    tx_no: str
    member_id: str
    batch_id: int
    tx_type: str
    points: int
    operator: Optional[str] = None
    remark: Optional[str] = None

class PointTransactionCreate(PointTransactionBase):
    related_tx_id: Optional[int] = None

class PointTransactionResponse(PointTransactionBase):
    id: int
    before_balance: Optional[int] = None
    after_balance: Optional[int] = None
    related_tx_id: Optional[int] = None
    status: str
    is_reviewed: bool
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    is_manual: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class BalanceSnapshotBase(BaseModel):
    snapshot_date: datetime
    member_id: str
    total_points: int
    available_points: int
    frozen_points: int
    expired_points: int
    consumed_points: int
    refunded_points: int

class BalanceSnapshotCreate(BalanceSnapshotBase):
    batch_count: Optional[int] = None
    tx_count: Optional[int] = None

class BalanceSnapshotResponse(BalanceSnapshotBase):
    id: int
    batch_count: Optional[int] = None
    tx_count: Optional[int] = None
    is_consistent: bool
    inconsistency_reason: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class ReviewRecordBase(BaseModel):
    review_type: str
    target_id: int
    target_type: Optional[str] = None
    remark: Optional[str] = None

class ReviewRecordCreate(ReviewRecordBase):
    pass

class ReviewRecordResponse(ReviewRecordBase):
    id: int
    before_data: Optional[str] = None
    after_data: Optional[str] = None
    comparison_result: Optional[str] = None
    status: str
    reviewer: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class ManualCorrectionRequest(BaseModel):
    tx_id: int
    new_points: int
    reason: str
    operator: str

class ComparisonResult(BaseModel):
    is_consistent: bool
    differences: List[str]
    calculated_balance: int
    snapshot_balance: int

class ProcessChainItem(BaseModel):
    order: int
    type: str
    id: int
    no: str
    points: int
    date: datetime
    status: str
    description: str

class ProcessChainResponse(BaseModel):
    member_id: str
    batch: PointBatchResponse
    frozen: List[FrozenBalanceResponse]
    transactions: List[PointTransactionResponse]
    snapshots: List[BalanceSnapshotResponse]
    chain: List[ProcessChainItem]
