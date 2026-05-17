from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, Dict, Any, List

from .enums import CompensationType, CompensationStatus, OrderStatus


@dataclass
class BadRow:
    file_path: str
    sheet_name: Optional[str]
    row_number: int
    raw_data: Dict[str, Any]
    error_message: str
    created_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "file_path": self.file_path,
            "sheet_name": self.sheet_name or "",
            "row_number": self.row_number,
            "error_message": self.error_message,
            **self.raw_data,
        }


@dataclass
class Batch:
    batch_id: str
    batch_name: str
    start_time: datetime
    end_time: datetime
    status: str
    source_file: str
    source_row: int
    extra: Dict[str, Any] = field(default_factory=dict)


@dataclass
class OrderItem:
    order_id: str
    sku_id: str
    sku_name: str
    quantity: int
    unit_price: float
    total_amount: float
    user_id: str
    user_name: str
    order_time: datetime
    order_status: OrderStatus
    batch_id: str
    source_file: str
    source_row: int
    extra: Dict[str, Any] = field(default_factory=dict)


@dataclass
class OutOfStockItem:
    batch_id: str
    sku_id: str
    sku_name: str
    total_ordered: int
    available_quantity: int
    shortage_quantity: int
    source_file: str
    source_row: int
    extra: Dict[str, Any] = field(default_factory=dict)


@dataclass
class CompensationPlan:
    plan_id: str
    batch_id: str
    sku_id: str
    order_id: str
    user_id: str
    compensation_type: CompensationType
    quantity: int
    refund_amount: Optional[float] = None
    exchange_sku_id: Optional[str] = None
    exchange_sku_name: Optional[str] = None
    points_amount: Optional[int] = None
    source_file: str = ""
    source_row: int = 0
    status: CompensationStatus = CompensationStatus.PENDING
    extra: Dict[str, Any] = field(default_factory=dict)


@dataclass
class UserConfirmation:
    confirmation_id: str
    order_id: str
    sku_id: str
    user_id: str
    compensation_type: CompensationType
    confirmed_at: datetime
    confirmed: bool
    source_file: str
    source_row: int
    extra: Dict[str, Any] = field(default_factory=dict)


@dataclass
class SettlementRecord:
    settlement_id: str
    batch_id: str
    order_id: str
    sku_id: str
    user_id: str
    compensation_type: CompensationType
    quantity: int
    amount: float
    status: CompensationStatus
    inventory_written_back: bool
    settled_at: datetime
    source_trail: List[Dict[str, Any]] = field(default_factory=list)
    extra: Dict[str, Any] = field(default_factory=dict)
