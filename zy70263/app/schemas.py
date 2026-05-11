from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
from .models import WristbandStatus, DepositStatus, TransactionType, SettlementStatus


class WristbandBase(BaseModel):
    wristband_no: str
    visitor_name: Optional[str] = None
    deposit_amount: float = 20.0


class WristbandCreate(WristbandBase):
    pass


class WristbandResponse(BaseModel):
    id: int
    wristband_no: str
    visitor_name: Optional[str]
    status: WristbandStatus
    deposit_amount: float
    balance: float
    issued_at: datetime
    original_wristband_id: Optional[int]

    class Config:
        from_attributes = True


class DepositResponse(BaseModel):
    id: int
    wristband_id: int
    amount: float
    status: DepositStatus
    frozen_at: datetime
    unfrozen_at: Optional[datetime]

    class Config:
        from_attributes = True


class DepositRecharge(BaseModel):
    amount: float


class TransactionResponse(BaseModel):
    id: int
    wristband_id: int
    transaction_type: TransactionType
    amount: float
    description: Optional[str]
    balance_after: float
    created_at: datetime

    class Config:
        from_attributes = True


class ConsumptionRequest(BaseModel):
    amount: float
    description: Optional[str] = None


class LossReport(BaseModel):
    new_wristband_no: str
    replacement_fee: float = 10.0


class SettlementResponse(BaseModel):
    id: int
    settlement_date: datetime
    status: SettlementStatus
    total_deposit_frozen: float
    total_deposit_refunded: float
    total_deposit_forfeited: float
    total_consumption: float
    total_replacement_fees: float
    export_file_path: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class StatisticsResponse(BaseModel):
    total_wristbands: int
    active_wristbands: int
    total_deposit_frozen: float
    total_balance: float
    total_consumption: float
    total_replacement_fees: float
