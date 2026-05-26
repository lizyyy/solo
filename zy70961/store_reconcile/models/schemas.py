from __future__ import annotations

import uuid
from datetime import date, datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, validator


class ReconcileStatus(str, Enum):
    NORMAL = "normal"
    PENDING = "pending"
    FAILED = "failed"


class DepositRecord(BaseModel):
    store_id: str
    deposit_date: str
    amount: float
    deposit_method: str = "cash"
    reference_no: Optional[str] = None
    raw_data: Dict[str, Any] = Field(default_factory=dict)

    @validator("deposit_date")
    @classmethod
    def validate_date_format(cls, v: str) -> str:
        try:
            datetime.strptime(v, "%Y-%m-%d")
        except ValueError:
            raise ValueError(f"日期格式错误，应为 YYYY-MM-DD: {v}")
        return v


class SalesRecord(BaseModel):
    store_id: str
    sale_date: str
    total_amount: float
    cash_amount: float = 0.0
    pos_amount: float = 0.0
    other_amount: float = 0.0
    transaction_count: int = 0
    raw_data: Dict[str, Any] = Field(default_factory=dict)

    @validator("sale_date")
    @classmethod
    def validate_date_format(cls, v: str) -> str:
        try:
            datetime.strptime(v, "%Y-%m-%d")
        except ValueError:
            raise ValueError(f"日期格式错误，应为 YYYY-MM-DD: {v}")
        return v


class PettyCashRecord(BaseModel):
    store_id: str
    txn_date: str
    txn_type: str
    amount: float
    balance_after: float = 0.0
    reference: Optional[str] = None
    description: Optional[str] = None
    raw_data: Dict[str, Any] = Field(default_factory=dict)

    @validator("txn_type")
    @classmethod
    def validate_txn_type(cls, v: str) -> str:
        valid_types = {"income", "expense", "replenish", "adjust"}
        if v.lower() not in valid_types:
            raise ValueError(f"备用金类型无效，必须为: {valid_types}")
        return v.lower()

    @validator("txn_date")
    @classmethod
    def validate_date_format(cls, v: str) -> str:
        try:
            datetime.strptime(v, "%Y-%m-%d")
        except ValueError:
            raise ValueError(f"日期格式错误，应为 YYYY-MM-DD: {v}")
        return v


class ReconcileItem(BaseModel):
    item_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    store_id: str
    record_date: str
    status: ReconcileStatus
    category: str
    deposit_amount: Optional[float] = None
    sales_amount: Optional[float] = None
    petty_cash_change: Optional[float] = None
    difference: Optional[float] = None
    raw_record: Dict[str, Any] = Field(default_factory=dict)
    suggestion: Optional[str] = None
    error_message: Optional[str] = None
    rule_matched: Optional[List[str]] = None


class ReconcileResult(BaseModel):
    batch_id: str
    batch_date: str
    processed_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    total_count: int = 0
    normal_count: int = 0
    pending_count: int = 0
    failed_count: int = 0
    normal_items: List[ReconcileItem] = Field(default_factory=list)
    pending_items: List[ReconcileItem] = Field(default_factory=list)
    failed_items: List[ReconcileItem] = Field(default_factory=list)
    summary: Dict[str, Any] = Field(default_factory=dict)


class ReconcileBatch(BaseModel):
    batch_id: str
    batch_date: str
    upload_time: str = Field(default_factory=lambda: datetime.now().isoformat())
    store_id: str
    status: str = "processing"
    deposit_count: int = 0
    sales_count: int = 0
    petty_cash_count: int = 0
    source_hash: Optional[str] = None
    error_message: Optional[str] = None


class ReconcileRequest(BaseModel):
    store_id: str
    batch_date: str
    deposits: List[DepositRecord] = Field(default_factory=list)
    sales: List[SalesRecord] = Field(default_factory=list)
    petty_cash: List[PettyCashRecord] = Field(default_factory=list)

    @validator("batch_date")
    @classmethod
    def validate_date_format(cls, v: str) -> str:
        try:
            datetime.strptime(v, "%Y-%m-%d")
        except ValueError:
            raise ValueError(f"日期格式错误，应为 YYYY-MM-DD: {v}")
        return v


class BatchUploadRequest(BaseModel):
    store_id: str
    batch_date: str
    deposit_csv_content: Optional[str] = None
    sales_json_content: Optional[str] = None
    petty_cash_json_content: Optional[str] = None

    @validator("batch_date")
    @classmethod
    def validate_date_format(cls, v: str) -> str:
        try:
            datetime.strptime(v, "%Y-%m-%d")
        except ValueError:
            raise ValueError(f"日期格式错误，应为 YYYY-MM-DD: {v}")
        return v


class TraceNode(BaseModel):
    txn_date: str
    txn_type: str
    amount: float
    balance_after: float
    reference: Optional[str] = None
    description: Optional[str] = None
    source_batch_id: Optional[str] = None
    raw_data: Dict[str, Any] = Field(default_factory=dict)


class TraceResult(BaseModel):
    store_id: str
    target_date: str
    current_balance: float
    opening_balance: float
    total_income: float = 0.0
    total_expense: float = 0.0
    total_replenish: float = 0.0
    total_adjust: float = 0.0
    trace_path: List[TraceNode] = Field(default_factory=list)
    earliest_date: Optional[str] = None
